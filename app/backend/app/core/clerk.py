"""Clerk JWT verification and Backend API user resolution utilities."""

import asyncio
import base64
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
import jwt
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

CLERK_API_BASE_URL = "https://api.clerk.com/v1"
DEFAULT_JWKS_CACHE_TTL_SECONDS = 1800  # 30 minutes
DEFAULT_USER_CACHE_TTL_SECONDS = 300   # 5 minutes


class ClerkAuthError(Exception):
    """Raised when Clerk JWT validation fails."""

    def __init__(self, detail: str, status_code: int = 401):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class ClerkTokenClaims(BaseModel):
    """Normalized claims extracted from a verified Clerk session JWT."""

    sub: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    username: Optional[str] = None
    image_url: Optional[str] = None
    role: str = "USER"
    sid: Optional[str] = None
    azp: Optional[str] = None
    raw_claims: Dict[str, Any] = Field(default_factory=dict)


def derive_frontend_api_from_publishable_key(publishable_key: str) -> Optional[str]:
    """Decode Clerk Frontend API domain from a pk_test_ / pk_live_ publishable key."""
    if not publishable_key:
        return None
    parts = publishable_key.strip().split("_", 2)
    if len(parts) != 3 or parts[0] != "pk":
        return None
    encoded = parts[2]
    padding = "=" * ((4 - len(encoded) % 4) % 4)
    try:
        decoded = base64.b64decode(encoded + padding).decode("utf-8").rstrip("$").strip()
        return decoded or None
    except Exception:
        return None


def _normalize_pem_key(pem_key: str) -> str:
    """Normalize single-line escaped PEM keys from .env files."""
    return pem_key.strip().replace("\\n", "\n")


class ClerkVerifier:
    """Verifies Clerk session JWTs using PEM key or cached JWKS and fetches user metadata."""

    def __init__(
        self,
        publishable_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        jwks_url: Optional[str] = None,
        issuer: Optional[str] = None,
        jwt_key: Optional[str] = None,
        authorized_parties: Optional[str] = None,
        jwks_cache_ttl: int = DEFAULT_JWKS_CACHE_TTL_SECONDS,
    ):
        self._publishable_key_override = publishable_key
        self._secret_key_override = secret_key
        self._jwks_url_override = jwks_url
        self._issuer_override = issuer
        self._jwt_key_override = jwt_key
        self._authorized_parties_override = authorized_parties
        self._jwks_cache_ttl = jwks_cache_ttl

        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_cached_at: float = 0.0
        self._jwks_lock = asyncio.Lock()

        self._user_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

    @property
    def publishable_key(self) -> str:
        if self._publishable_key_override is not None:
            return self._publishable_key_override.strip()
        return (settings.CLERK_PUBLISHABLE_KEY or settings.VITE_CLERK_PUBLISHABLE_KEY).strip()

    @property
    def secret_key(self) -> str:
        return (self._secret_key_override if self._secret_key_override is not None else settings.CLERK_SECRET_KEY).strip()

    @property
    def jwks_url(self) -> str:
        return (self._jwks_url_override or "").strip()

    @property
    def issuer(self) -> str:
        return (self._issuer_override or "").strip().rstrip("/")

    @property
    def jwt_key(self) -> str:
        return (self._jwt_key_override or "").strip()

    @property
    def authorized_parties(self) -> List[str]:
        raw = self._authorized_parties_override or ""
        return [party.strip() for party in raw.split(",") if party.strip()]

    @property
    def is_configured(self) -> bool:
        """True if any Clerk verification configuration is present."""
        return bool(
            self.jwt_key
            or self.jwks_url
            or self.issuer
            or self.publishable_key
            or self.secret_key
        )

    def _resolve_jwks_source(self) -> Tuple[Optional[str], Dict[str, str]]:
        """Resolve the JWKS URL and any required request headers."""
        if self.jwks_url:
            return self.jwks_url, {}
        if self.issuer:
            return f"{self.issuer}/.well-known/jwks.json", {}

        domain = derive_frontend_api_from_publishable_key(self.publishable_key)
        if domain:
            return f"https://{domain}/.well-known/jwks.json", {}

        if self.secret_key:
            return f"{CLERK_API_BASE_URL}/jwks", {"Authorization": f"Bearer {self.secret_key}"}

        return None, {}

    async def _fetch_jwks(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch and cache Clerk JWKS with lock to avoid concurrent stampedes."""
        now = time.monotonic()
        if not force_refresh and self._jwks_cache and (now - self._jwks_cached_at) < self._jwks_cache_ttl:
            return self._jwks_cache

        async with self._jwks_lock:
            now = time.monotonic()
            if not force_refresh and self._jwks_cache and (now - self._jwks_cached_at) < self._jwks_cache_ttl:
                return self._jwks_cache

            url, headers = self._resolve_jwks_source()
            if not url:
                raise ClerkAuthError("Clerk verification is not configured on the server.", status_code=503)

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, headers=headers)
                    resp.raise_for_status()
                    jwks_data = resp.json()
            except Exception as exc:
                logger.error(f"Failed to fetch Clerk JWKS from {url}: {exc}")
                raise ClerkAuthError("Unable to verify session token against Clerk JWKS.", status_code=503) from exc

            if not isinstance(jwks_data, dict) or "keys" not in jwks_data:
                raise ClerkAuthError("Malformed JWKS response from Clerk.", status_code=503)

            self._jwks_cache = jwks_data
            self._jwks_cached_at = time.monotonic()
            return jwks_data

    async def _resolve_signing_key(self, token: str) -> Any:
        """Return an RSA verification key from PEM config or matching JWKS kid."""
        if self.jwt_key:
            return _normalize_pem_key(self.jwt_key)

        try:
            unverified_header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise ClerkAuthError("Invalid JWT header.") from exc

        kid = unverified_header.get("kid")
        if not kid:
            raise ClerkAuthError("Missing key ID (kid) in JWT header.")

        jwks = await self._fetch_jwks(force_refresh=False)
        jwk_dict = self._find_jwk_by_kid(jwks, kid)
        if not jwk_dict:
            jwks = await self._fetch_jwks(force_refresh=True)
            jwk_dict = self._find_jwk_by_kid(jwks, kid)

        if not jwk_dict:
            raise ClerkAuthError("Matching signing key not found in Clerk JWKS.")

        try:
            return jwt.algorithms.RSAAlgorithm.from_jwk(jwk_dict)
        except Exception as exc:
            raise ClerkAuthError("Failed to construct RSA key from Clerk JWK.") from exc

    @staticmethod
    def _find_jwk_by_kid(jwks: Dict[str, Any], kid: str) -> Optional[Dict[str, Any]]:
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return key
        return None

    async def verify_token(self, token: str) -> ClerkTokenClaims:
        """Verify a Clerk session JWT and return normalized claims."""
        if not self.is_configured:
            raise ClerkAuthError("Clerk authentication is not configured.", status_code=503)

        signing_key = await self._resolve_signing_key(token)

        decode_kwargs: Dict[str, Any] = {
            "algorithms": ["RS256"],
            "leeway": 5,
            "options": {"verify_aud": False},
        }
        if self.issuer:
            decode_kwargs["issuer"] = self.issuer

        try:
            payload = jwt.decode(token, signing_key, **decode_kwargs)
        except jwt.ExpiredSignatureError as exc:
            raise ClerkAuthError("Clerk session token has expired.") from exc
        except jwt.InvalidIssuerError as exc:
            raise ClerkAuthError("Clerk session token issuer mismatch.") from exc
        except jwt.PyJWTError as exc:
            raise ClerkAuthError(f"Invalid Clerk session token: {exc}") from exc

        sub = payload.get("sub")
        if not sub or not isinstance(sub, str):
            raise ClerkAuthError("Missing subject (sub) in Clerk session token.")

        azp = payload.get("azp")
        allowed_parties = self.authorized_parties
        if allowed_parties and azp and azp not in allowed_parties:
            raise ClerkAuthError("Token authorized party (azp) is not allowed.")

        public_meta = payload.get("public_metadata") or payload.get("metadata") or {}
        role = str(
            payload.get("role")
            or (public_meta.get("role") if isinstance(public_meta, dict) else None)
            or "USER"
        ).upper()

        first_name = payload.get("first_name") or ""
        last_name = payload.get("last_name") or ""
        combined_name = f"{first_name} {last_name}".strip()
        full_name = payload.get("name") or payload.get("full_name") or (combined_name or None)

        return ClerkTokenClaims(
            sub=sub,
            email=payload.get("email"),
            full_name=full_name,
            username=payload.get("username"),
            image_url=payload.get("image_url") or payload.get("picture"),
            role=role,
            sid=payload.get("sid"),
            azp=azp,
            raw_claims=payload,
        )

    async def fetch_user_profile(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile from Clerk Backend API when session JWT omits email/name."""
        if not self.secret_key or not clerk_user_id:
            return None

        now = time.monotonic()
        cached = self._user_cache.get(clerk_user_id)
        if cached and (now - cached[0]) < DEFAULT_USER_CACHE_TTL_SECONDS:
            return cached[1]

        url = f"{CLERK_API_BASE_URL}/users/{clerk_user_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.secret_key}"},
                )
                if resp.status_code != 200:
                    logger.warning(f"Clerk Backend API returned {resp.status_code} for user {clerk_user_id}")
                    return None
                data = resp.json()
        except Exception as exc:
            logger.warning(f"Failed fetching Clerk user profile for {clerk_user_id}: {exc}")
            return None

        email = None
        primary_email_id = data.get("primary_email_address_id")
        for addr in data.get("email_addresses") or []:
            if primary_email_id and addr.get("id") == primary_email_id:
                email = addr.get("email_address")
                break
            if not email and addr.get("email_address"):
                email = addr.get("email_address")

        first = (data.get("first_name") or "").strip()
        last = (data.get("last_name") or "").strip()
        full_name = f"{first} {last}".strip() or None

        profile = {
            "clerk_id": clerk_user_id,
            "email": email,
            "full_name": full_name,
            "username": data.get("username"),
            "image_url": data.get("image_url"),
        }
        self._user_cache[clerk_user_id] = (now, profile)
        return profile


clerk_verifier = ClerkVerifier()

