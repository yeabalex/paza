"""Security and Authentication utilities module."""

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Optional

import jwt
from fastapi import Header, HTTPException, status

from app.core.clerk import ClerkAuthError, clerk_verifier
from app.core.config import settings

logger = logging.getLogger(__name__)


def deterministic_numeric_id(identifier: str) -> int:
    """Convert an arbitrary user ID (e.g. Clerk user_xxx) into a stable BIGINT-safe integer."""
    text = str(identifier).strip()
    if text.isdigit():
        val = int(text)
        if 0 < val <= 9_000_000_000_000_000_000:
            return val
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return int.from_bytes(digest[:7], "big") or 1


def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2 with SHA256."""
    salt = settings.JWT_SECRET_KEY[:16].encode("utf-8")
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return key.hex()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against stored hash."""
    return hmac.compare_digest(hash_password(plain_password), hashed_password)


def create_access_token(user_id: str, email: str, role: str) -> str:
    """Generates an HMAC-SHA256 signed JWT bearer token."""
    if not settings.JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY is not configured.")
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    expires = now + (settings.JWT_ACCESS_TOKEN_EXPIRE_DAYS * 86400)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": expires,
    }

    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature_base = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), signature_base, hashlib.sha256).digest()
    sig_b64 = _b64url(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates HMAC-SHA256 signed JWT token."""
    if not settings.JWT_SECRET_KEY:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        signature_base = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), signature_base, hashlib.sha256).digest()

        def _b64decode(s: str) -> bytes:
            padding = "=" * (4 - len(s) % 4)
            return base64.urlsafe_b64decode(s + padding)

        if not hmac.compare_digest(_b64decode(sig_b64), expected_sig):
            return None

        payload_bytes = _b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        if payload.get("exp", 0) < int(time.time()):
            logger.warning("Token expired")
            return None

        return payload
    except Exception as e:
        logger.warning(f"Failed to decode token: {e}")
        return None


# ════════════════════════════════════════════════════════════════════════════════
# FastAPI Reusable Auth Dependencies
# ════════════════════════════════════════════════════════════════════════════════


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Bearer authorization header.",
        )
    return parts[1].strip()


def _is_clerk_jwt(token: str) -> bool:
    try:
        header = jwt.get_unverified_header(token)
        return header.get("alg") == "RS256" or bool(header.get("kid"))
    except Exception:
        return False


async def resolve_bearer_user(token: str) -> dict:
    """Verify a Bearer token (Clerk RS256 JWT or legacy HS256 JWT) and return user context."""
    if clerk_verifier.is_configured and (_is_clerk_jwt(token) or not settings.JWT_SECRET_KEY):
        try:
            claims = await clerk_verifier.verify_token(token)
        except ClerkAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        return {
            "id": claims.sub,
            "clerk_id": claims.sub,
            "user_id": deterministic_numeric_id(claims.sub),
            "email": claims.email,
            "full_name": claims.full_name,
            "username": claims.username,
            "image_url": claims.image_url,
            "role": claims.role,
            "auth_provider": "clerk",
        }

    payload = decode_access_token(token)
    if payload and "sub" in payload:
        sub_val = str(payload["sub"])
        return {
            "id": sub_val,
            "user_id": deterministic_numeric_id(sub_val),
            "email": payload.get("email"),
            "role": payload.get("role", "USER"),
            "auth_provider": "legacy_jwt",
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session token.",
    )


async def require_api_key(x_api_key: str = Header(..., alias="X-Api-Key")) -> str:
    """Validates the X-Api-Key header against PIPELINE_API_KEY.

    Use as a dependency on server-to-server routes (n8n trigger, cron jobs).
    Raises 403 if the key is missing, empty, or does not match.
    """
    if not settings.PIPELINE_API_KEY:
        logger.error("PIPELINE_API_KEY is not configured on the server — rejecting request.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server API key not configured.",
        )
    if not hmac.compare_digest(x_api_key, settings.PIPELINE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )
    return x_api_key


async def require_authenticated_web_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> dict:
    """Strictly require a valid Clerk or legacy Bearer JWT."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authorization token.",
        )
    return await resolve_bearer_user(token)


async def get_current_web_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> dict:
    """Strictly require and verify a Clerk or legacy Bearer JWT for protected user routes."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return await resolve_bearer_user(token)


