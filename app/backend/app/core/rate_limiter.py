"""Global Rate Limiter & Starlette Middleware for Paza API.

Provides:
- Distributed Redis-backed rate limiting with atomic pipeline increments.
- Resilient in-memory sliding window fallback if Redis is unreachable or absent.
- Tiered path limits (Scraper Triggers, Auth endpoints, and default general routes).
- Standard rate-limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After).
- Safe exemptions for CORS OPTIONS preflight, health checks, dev docs, and static files.
"""

import asyncio
import hashlib
import logging
import time
from typing import Dict, List, Optional, Tuple

import redis.asyncio as aioredis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """Manages rate limit state across Redis with an automatic in-memory sliding-window fallback."""

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis_client: Optional[aioredis.Redis] = None
        self._redis_disabled: bool = False
        # In-memory sliding-window storage: key -> list of float timestamps
        self._memory_store: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()
        self._last_prune: float = time.time()

    async def get_redis_client(self) -> Optional[aioredis.Redis]:
        """Lazily initialize and return Redis client, or None if disabled/unreachable."""
        if self._redis_disabled:
            return None
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.Redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_timeout=1.0,
                    socket_connect_timeout=1.0,
                )
            except Exception as e:
                logger.warning(f"RateLimiter: Failed to connect to Redis at {self.redis_url}: {e}. Falling back to in-memory limiter.")
                self._redis_disabled = True
                return None
        return self._redis_client

    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60,
    ) -> Tuple[bool, int, int]:
        """Check whether `key` is within `limit` for the given time window.

        Returns:
            Tuple[is_allowed: bool, remaining: int, reset_seconds: int]
        """
        now = time.time()
        client = await self.get_redis_client()

        if client is not None:
            try:
                bucket = int(now // window_seconds)
                redis_key = f"paza:ratelimit:{key}:{bucket}"
                async with client.pipeline(transaction=True) as pipe:
                    pipe.incr(redis_key)
                    pipe.expire(redis_key, window_seconds + 10)
                    results = await pipe.execute()
                count = int(results[0])
                reset_seconds = max(1, int(window_seconds - (now % window_seconds)))
                remaining = max(0, limit - count)
                is_allowed = count <= limit
                return is_allowed, remaining, reset_seconds
            except Exception as e:
                logger.warning(f"RateLimiter: Redis error during check ({e}). Using in-memory fallback.")
                self._redis_disabled = True

        # In-memory sliding-window fallback
        async with self._lock:
            # Periodic cleanup of expired keys every 60s
            if now - self._last_prune > 60:
                self._prune_memory_store(now, window_seconds)
                self._last_prune = now

            timestamps = self._memory_store.setdefault(key, [])
            cutoff = now - window_seconds
            # Retain only timestamps within the current window
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._memory_store[key] = valid_timestamps

            count = len(valid_timestamps)
            if count >= limit:
                oldest = valid_timestamps[0] if valid_timestamps else now
                reset_seconds = max(1, int(window_seconds - (now - oldest)))
                return False, 0, reset_seconds

            valid_timestamps.append(now)
            remaining = max(0, limit - (count + 1))
            reset_seconds = max(1, int(window_seconds - (now - valid_timestamps[0])))
            return True, remaining, reset_seconds

    def _prune_memory_store(self, now: float, window_seconds: int):
        """Remove keys whose timestamps have all expired."""
        cutoff = now - window_seconds
        expired_keys = [k for k, ts in self._memory_store.items() if not ts or ts[-1] <= cutoff]
        for k in expired_keys:
            self._memory_store.pop(k, None)


# Global singleton instance used by the middleware
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware applying rate limiting centrally across all routes."""

    EXEMPT_PATHS = {
        "/",
        f"{settings.API_V1_STR}/health",
        "/health",
    }

    DEV_DOCS_PATHS = {
        "/docs",
        "/redoc",
        f"{settings.API_V1_STR}/openapi.json",
    }

    def _get_client_identifier(self, request: Request) -> str:
        """Derive a stable rate-limiting identifier from API key, Bearer token, or Client IP."""
        # Check for X-Api-Key header (server-to-server / n8n)
        api_key = request.headers.get("X-Api-Key")
        if api_key:
            hashed_key = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]
            return f"apikey:{hashed_key}"

        # Check for Bearer token (authenticated web user)
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            raw_token = auth[7:].strip()
            if raw_token:
                hashed_token = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()[:16]
                return f"token:{hashed_token}"

        # Client IP address (with X-Forwarded-For support behind reverse proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
            if client_ip:
                return f"ip:{client_ip}"

        if request.client and request.client.host:
            return f"ip:{request.client.host}"

        return "ip:unknown"

    def _resolve_limit(self, path: str) -> Optional[int]:
        """Determine rate limit based on endpoint path, or None if exempt."""
        if path in self.EXEMPT_PATHS:
            return None

        is_prod = settings.ENVIRONMENT.lower() == "production" and not settings.DEBUG
        if not is_prod and path in self.DEV_DOCS_PATHS:
            return None

        if path.startswith("/static"):
            return None

        # Scraper execution endpoints (pipeline trigger is heavy)
        if path.startswith(f"{settings.API_V1_STR}/scraper/trigger"):
            return getattr(settings, "RATE_LIMIT_SCRAPER_PER_MINUTE", 15)

        # Organizer Auth endpoints (brute-force protection)
        if path.startswith(f"{settings.API_V1_STR}/organizers/auth/"):
            return getattr(settings, "RATE_LIMIT_AUTH_PER_MINUTE", 20)

        # Default general API limit
        return getattr(settings, "RATE_LIMIT_DEFAULT_PER_MINUTE", 120)

    async def dispatch(self, request: Request, call_next) -> Response:
        # If rate limiting is disabled globally, pass through directly
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return await call_next(request)

        # Never rate limit CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        limit = self._resolve_limit(path)
        if limit is None:
            return await call_next(request)

        identifier = self._get_client_identifier(request)
        rate_key = f"{identifier}:{path}"

        is_allowed, remaining, reset_seconds = await rate_limiter.check_rate_limit(
            key=rate_key,
            limit=limit,
            window_seconds=60,
        )

        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_seconds),
        }

        if not is_allowed:
            headers["Retry-After"] = str(reset_seconds)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Maximum {limit} requests per minute allowed. Try again in {reset_seconds} seconds."
                },
                headers=headers,
            )

        response = await call_next(request)
        for h_key, h_val in headers.items():
            response.headers[h_key] = h_val
        return response

