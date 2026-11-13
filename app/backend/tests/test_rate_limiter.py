"""Tests for Global Rate Limiter and RateLimitMiddleware."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse, PlainTextResponse

from app.core.config import settings
from app.core.rate_limiter import RateLimiter, RateLimitMiddleware, rate_limiter


def test_rate_limiter_in_memory_sliding_window():
    """Verify RateLimiter sliding window handles limit enforcement and resets."""
    import asyncio

    limiter = RateLimiter(redis_url="redis://invalid-host:9999/0")
    limiter._redis_disabled = True  # force in-memory mode

    async def _test():
        key = "test_user_1"
        limit = 3
        window = 2

        # 3 requests allowed
        for i in range(limit):
            allowed, remaining, reset_secs = await limiter.check_rate_limit(key, limit=limit, window_seconds=window)
            assert allowed is True
            assert remaining == limit - (i + 1)
            assert reset_secs <= window

        # 4th request blocked
        allowed, remaining, reset_secs = await limiter.check_rate_limit(key, limit=limit, window_seconds=window)
        assert allowed is False
        assert remaining == 0
        assert reset_secs <= window

        # Separate key has its own bucket
        other_allowed, _, _ = await limiter.check_rate_limit("test_user_2", limit=limit, window_seconds=window)
        assert other_allowed is True

    asyncio.run(_test())


def test_middleware_enforces_rate_limit_and_returns_429():
    """Verify RateLimitMiddleware returns 429 and standard headers on excess requests."""
    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware)

    @test_app.get("/api/v1/test-endpoint")
    def sample_endpoint():
        return {"status": "ok"}

    # Temporarily set lower limit for testing
    orig_limit = settings.RATE_LIMIT_DEFAULT_PER_MINUTE
    orig_enabled = settings.RATE_LIMIT_ENABLED
    try:
        settings.RATE_LIMIT_ENABLED = True
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = 3

        client = TestClient(test_app, base_url="http://testserver")

        # First 3 requests succeed
        for i in range(3):
            res = client.get("/api/v1/test-endpoint", headers={"X-Forwarded-For": "192.168.1.100"})
            assert res.status_code == 200
            assert "X-RateLimit-Limit" in res.headers
            assert res.headers["X-RateLimit-Limit"] == "3"
            assert "X-RateLimit-Remaining" in res.headers
            assert "X-RateLimit-Reset" in res.headers

        # 4th request blocked with 429
        res = client.get("/api/v1/test-endpoint", headers={"X-Forwarded-For": "192.168.1.100"})
        assert res.status_code == 429
        assert "Retry-After" in res.headers
        assert res.headers["X-RateLimit-Remaining"] == "0"
        data = res.json()
        assert "Rate limit exceeded" in data.get("detail", "")

        # Request from a different IP still succeeds
        res_other = client.get("/api/v1/test-endpoint", headers={"X-Forwarded-For": "192.168.1.101"})
        assert res_other.status_code == 200

    finally:
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = orig_limit
        settings.RATE_LIMIT_ENABLED = orig_enabled


def test_options_and_exempt_endpoints_bypass_rate_limiting():
    """Verify OPTIONS, health check, and exempt routes bypass rate limits."""
    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware)

    @test_app.get("/api/v1/health")
    def health_endpoint():
        return {"status": "healthy"}

    orig_limit = settings.RATE_LIMIT_DEFAULT_PER_MINUTE
    orig_enabled = settings.RATE_LIMIT_ENABLED
    try:
        settings.RATE_LIMIT_ENABLED = True
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = 1

        client = TestClient(test_app, base_url="http://testserver")

        # Health endpoint can be called repeatedly without getting 429
        for _ in range(5):
            res = client.get("/api/v1/health", headers={"X-Forwarded-For": "10.0.0.1"})
            assert res.status_code == 200

        # OPTIONS preflight requests bypass rate limiting (never 429)
        for _ in range(5):
            res = client.options("/api/v1/health", headers={"X-Forwarded-For": "10.0.0.1"})
            assert res.status_code != 429

    finally:
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = orig_limit
        settings.RATE_LIMIT_ENABLED = orig_enabled


def test_rate_limit_disabled_flag():
    """Verify RATE_LIMIT_ENABLED=False disables all rate limiting."""
    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware)

    @test_app.get("/api/v1/disabled-test")
    def sample_endpoint():
        return {"status": "ok"}

    orig_enabled = settings.RATE_LIMIT_ENABLED
    orig_limit = settings.RATE_LIMIT_DEFAULT_PER_MINUTE
    try:
        settings.RATE_LIMIT_ENABLED = False
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = 1

        client = TestClient(test_app, base_url="http://testserver")

        # Send multiple requests; none should be rate-limited
        for _ in range(5):
            res = client.get("/api/v1/disabled-test", headers={"X-Forwarded-For": "10.0.0.2"})
            assert res.status_code == 200

    finally:
        settings.RATE_LIMIT_ENABLED = orig_enabled
        settings.RATE_LIMIT_DEFAULT_PER_MINUTE = orig_limit
