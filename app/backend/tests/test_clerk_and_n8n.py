"""Unit and integration tests for Clerk JWT auth and two-way API-key n8n integration."""

import base64
import json
import time
import unittest
from unittest.mock import AsyncMock, patch

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core import clerk as clerk_module
from app.core import security as security_module
from app.core.clerk import (
    ClerkAuthError,
    ClerkVerifier,
    derive_frontend_api_from_publishable_key,
)
from app.core.config import settings
from app.main import app
from app.services.integrations import (
    N8nWebhookClient,
    format_pipeline_telegram_message,
    job_store,
)


def _generate_rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    jwk_dict = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    return private_pem, public_pem, jwk_dict


class TestClerkVerification(unittest.IsolatedAsyncioTestCase):
    """Tests for Clerk JWT verification, JWKS key rotation, and web user resolution."""

    def setUp(self):
        self.private_pem, self.public_pem, self.jwk = _generate_rsa_keypair()
        self.jwk["kid"] = "test-kid-1"
        self.jwk["use"] = "sig"

    def test_derive_frontend_api_from_publishable_key(self):
        raw_domain = base64.b64encode(b"cool-dog-42.clerk.accounts.dev$").decode("utf-8").rstrip("=")
        pk = f"pk_test_{raw_domain}"
        self.assertEqual(
            derive_frontend_api_from_publishable_key(pk),
            "cool-dog-42.clerk.accounts.dev",
        )
        self.assertIsNone(derive_frontend_api_from_publishable_key("invalid-key"))

    def test_deterministic_numeric_id_is_stable(self):
        id_a = security_module.deterministic_numeric_id("user_2abcXYZ123")
        id_b = security_module.deterministic_numeric_id("user_2abcXYZ123")
        id_c = security_module.deterministic_numeric_id("user_2other456")
        self.assertEqual(id_a, id_b)
        self.assertNotEqual(id_a, id_c)
        self.assertGreater(id_a, 0)
        self.assertLess(id_a, 2**63 - 1)

    async def test_verify_token_with_pem_key_succeeds(self):
        verifier = ClerkVerifier(
            jwt_key=self.public_pem,
            issuer="https://clerk.example.com",
            authorized_parties="http://localhost:5173,https://paza.app",
        )
        now = int(time.time())
        token = jwt.encode(
            {
                "sub": "user_2clerk123",
                "iss": "https://clerk.example.com",
                "azp": "http://localhost:5173",
                "email": "ada@example.com",
                "first_name": "Ada",
                "last_name": "Lovelace",
                "exp": now + 300,
                "iat": now,
            },
            self.private_pem,
            algorithm="RS256",
            headers={"kid": "test-kid-1"},
        )
        claims = await verifier.verify_token(token)
        self.assertEqual(claims.sub, "user_2clerk123")
        self.assertEqual(claims.email, "ada@example.com")
        self.assertEqual(claims.full_name, "Ada Lovelace")

    async def test_verify_token_rejects_expired_and_bad_azp(self):
        verifier = ClerkVerifier(
            jwt_key=self.public_pem,
            authorized_parties="https://trusted.example.com",
        )
        now = int(time.time())
        expired_token = jwt.encode(
            {"sub": "user_1", "exp": now - 60, "iat": now - 120},
            self.private_pem,
            algorithm="RS256",
        )
        with self.assertRaises(ClerkAuthError):
            await verifier.verify_token(expired_token)

        bad_azp_token = jwt.encode(
            {"sub": "user_1", "azp": "https://evil.example.com", "exp": now + 60},
            self.private_pem,
            algorithm="RS256",
        )
        with self.assertRaises(ClerkAuthError):
            await verifier.verify_token(bad_azp_token)

    async def test_verify_token_refreshes_jwks_on_kid_rotation(self):
        priv2, _, jwk2 = _generate_rsa_keypair()
        jwk2["kid"] = "rotated-kid-2"
        jwk2["use"] = "sig"

        verifier = ClerkVerifier(jwks_url="https://clerk.test/.well-known/jwks.json")
        verifier._jwks_cache = {"keys": [self.jwk]}
        verifier._jwks_cached_at = time.monotonic()

        now = int(time.time())
        token = jwt.encode(
            {"sub": "user_rotated", "exp": now + 300},
            priv2,
            algorithm="RS256",
            headers={"kid": "rotated-kid-2"},
        )

        mock_resp = AsyncMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json = lambda: {"keys": [self.jwk, jwk2]}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch.object(clerk_module.httpx, "AsyncClient", return_value=mock_client):
            claims = await verifier.verify_token(token)

        self.assertEqual(claims.sub, "user_rotated")
        mock_client.get.assert_awaited_once()

    async def test_get_current_web_user_enforces_strict_auth_and_validates_clerk(self):
        verifier = ClerkVerifier(jwt_key=self.public_pem)
        now = int(time.time())
        token = jwt.encode(
            {"sub": "user_clerk_99", "email": "user@paza.et", "exp": now + 300},
            self.private_pem,
            algorithm="RS256",
            headers={"kid": "test-kid-1"},
        )

        with patch.object(security_module, "clerk_verifier", verifier):
            user_ctx = await security_module.get_current_web_user(
                authorization=f"Bearer {token}",
            )
            self.assertEqual(user_ctx["auth_provider"], "clerk")
            self.assertEqual(user_ctx["clerk_id"], "user_clerk_99")
            self.assertEqual(
                user_ctx["user_id"],
                security_module.deterministic_numeric_id("user_clerk_99"),
            )

            with self.assertRaises(HTTPException) as ctx:
                await security_module.get_current_web_user(
                    authorization="Bearer invalid.token.here",
                )
            self.assertEqual(ctx.exception.status_code, 401)

            with self.assertRaises(HTTPException) as ctx2:
                await security_module.get_current_web_user(authorization=None)
            self.assertEqual(ctx2.exception.status_code, 401)


class TestN8nTwoWayIntegration(unittest.IsolatedAsyncioTestCase):
    """Tests for inbound/outbound API key auth and n8n webhook notification."""

    def test_format_telegram_messages(self):
        ok_msg = format_pipeline_telegram_message(
            job_id="job_abc",
            status="success",
            summary={
                "duration_seconds": 12.4,
                "targets_processed": 5,
                "total_posts_scraped": 20,
                "events_extracted": 7,
                "passed_events_skipped": 2,
                "passed_events_cleaned": 1,
                "failed_transcriptions": 0,
                "failed_extractions": 0,
            },
        )
        self.assertIn("Paza Scraper Pipeline Completed", ok_msg)
        self.assertIn("<code>job_abc</code>", ok_msg)
        self.assertIn("7", ok_msg)

        err_msg = format_pipeline_telegram_message(
            job_id="job_err",
            status="failed",
            error="DB <connection> timeout",
        )
        self.assertIn("Paza Scraper Pipeline Failed", err_msg)
        self.assertIn("DB &lt;connection&gt; timeout", err_msg)

    async def test_outbound_n8n_requires_api_key_and_sends_header(self):
        no_key_client = N8nWebhookClient(
            webhook_url="https://n8n.example.com/webhook/paza",
            api_key="",
        )
        sent_without_key = await no_key_client.notify_pipeline_result(
            job_id="job_no_key",
            status="success",
            triggered_at="2026-11-11T10:00:00Z",
            summary={"events_extracted": 1},
        )
        self.assertFalse(sent_without_key)

        authed_client = N8nWebhookClient(
            webhook_url="https://n8n.example.com/webhook/paza",
            api_key="outbound-secret-xyz",
            api_key_header="X-Api-Key",
        )
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"received": true}'

        mock_http = AsyncMock()
        mock_http.__aenter__.return_value = mock_http
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.integrations.n8n_client.httpx.AsyncClient", return_value=mock_http):
            sent = await authed_client.notify_pipeline_result(
                job_id="job_123",
                status="success",
                triggered_at="2026-11-11T10:00:00Z",
                summary={"events_extracted": 4, "total_posts_scraped": 10},
            )

        self.assertTrue(sent)
        mock_http.post.assert_awaited_once()
        call_kwargs = mock_http.post.call_args.kwargs
        self.assertEqual(call_kwargs["headers"]["X-Api-Key"], "outbound-secret-xyz")
        self.assertEqual(call_kwargs["json"]["job_id"], "job_123")
        self.assertEqual(call_kwargs["json"]["status"], "success")
        self.assertIn("telegram_message", call_kwargs["json"])

    async def test_trigger_endpoint_two_way_flow(self):
        fake_summary = {
            "duration_seconds": 3.5,
            "targets_processed": 2,
            "total_posts_scraped": 8,
            "events_extracted": 3,
            "non_events_count": 5,
            "passed_events_skipped": 0,
            "passed_events_cleaned": 0,
            "failed_transcriptions": 0,
            "failed_extractions": 0,
        }

        with (
            patch.object(settings, "PIPELINE_API_KEY", "inbound-secret-123"),
            patch.object(settings, "N8N_WEBHOOK_URL", "https://n8n.example.com/webhook/paza"),
            patch.object(settings, "N8N_API_KEY", "outbound-secret-456"),
            patch("app.api.v1.endpoints.scraper.run_pipeline_gateway", new=AsyncMock(return_value=fake_summary)),
            patch("app.api.v1.endpoints.scraper.n8n_client.notify_pipeline_result", new=AsyncMock(return_value=True)) as mock_notify,
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                bad_res = await client.post(
                    "/api/v1/scraper/trigger",
                    headers={"X-Api-Key": "wrong-key"},
                )
                self.assertEqual(bad_res.status_code, 403)

                ok_res = await client.post(
                    "/api/v1/scraper/trigger?async_mode=true",
                    headers={"X-Api-Key": "inbound-secret-123"},
                    json={"trigger_source": "n8n", "notify_n8n": True, "job_id": "job_n8n_test"},
                )
                self.assertEqual(ok_res.status_code, 202)
                body = ok_res.json()
                self.assertEqual(body["job_id"], "job_n8n_test")
                self.assertTrue(body["callback_configured"])

                status_res = await client.get(
                    "/api/v1/scraper/jobs/job_n8n_test",
                    headers={"X-Api-Key": "inbound-secret-123"},
                )
                self.assertEqual(status_res.status_code, 200)
                self.assertEqual(status_res.json()["status"], "success")
                self.assertTrue(status_res.json()["n8n_notified"])

                mock_notify.assert_awaited_once()
                self.assertEqual(mock_notify.call_args.kwargs["job_id"], "job_n8n_test")
                self.assertEqual(mock_notify.call_args.kwargs["status"], "success")

        job_store._jobs.pop("job_n8n_test", None)


class TestS3StorageService(unittest.IsolatedAsyncioTestCase):
    """Tests for AWS S3 storage upload and URL generation."""

    async def test_s3_upload_calls_put_object_and_returns_s3_url(self):
        import io
        from unittest.mock import MagicMock
        from starlette.datastructures import Headers, UploadFile
        from app.services.storage.s3_service import S3StorageService

        mock_s3 = MagicMock()
        svc = S3StorageService()
        svc.bucket_name = "paza-events-media"
        svc.region = "us-east-1"

        upload = UploadFile(
            file=io.BytesIO(b"fake-image-bytes"),
            filename="poster.png",
            headers=Headers({"content-type": "image/png"}),
        )

        with patch.object(svc, "_get_s3_client", return_value=mock_s3):
            url = await svc.upload_file(upload, folder="events/123")

        mock_s3.put_object.assert_called_once()
        kwargs = mock_s3.put_object.call_args.kwargs
        self.assertEqual(kwargs["Bucket"], "paza-events-media")
        self.assertTrue(kwargs["Key"].startswith("events/123/"))
        self.assertTrue(kwargs["Key"].endswith(".png"))
        self.assertTrue(url.startswith("https://paza-events-media.s3.amazonaws.com/events/123/"))


class TestTelegramNotifier(unittest.IsolatedAsyncioTestCase):
    """Tests for direct Telegram notification restricted to a single authorized chat ID."""

    async def test_telegram_notifier_restricts_chat_id_and_sends_html(self):
        from app.services.integrations import TelegramBotNotifier

        unconfigured = TelegramBotNotifier(bot_token="", allowed_chat_id="6329130782")
        self.assertFalse(await unconfigured.send_message("hello"))

        notifier = TelegramBotNotifier(bot_token="12345:TEST_TOKEN", allowed_chat_id="6329130782")

        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"ok": true}'

        mock_http = AsyncMock()
        mock_http.__aenter__.return_value = mock_http
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.integrations.telegram_notifier.httpx.AsyncClient", return_value=mock_http):
            blocked = await notifier.send_message("blocked", chat_id="999999999")
            self.assertFalse(blocked)
            mock_http.post.assert_not_awaited()

            sent = await notifier.notify_pipeline_result(
                job_id="job_tg_1",
                status="success",
                trigger_source="cli",
                summary={
                    "duration_seconds": 4.2,
                    "targets_processed": 2,
                    "total_posts_scraped": 6,
                    "events_extracted": 2,
                    "extracted_titles": ["Addis Jazz Night", "Art Expo"],
                },
            )

        self.assertTrue(sent)
        mock_http.post.assert_awaited_once()
        call_args = mock_http.post.call_args
        self.assertEqual(call_args.args[0], "https://api.telegram.org/bot12345:TEST_TOKEN/sendMessage")
        payload = call_args.kwargs["json"]
        self.assertEqual(payload["chat_id"], "6329130782")
        self.assertEqual(payload["parse_mode"], "HTML")
        self.assertIn("Addis Jazz Night", payload["text"])

    async def test_trigger_endpoint_falls_back_to_telegram_when_n8n_unconfigured(self):
        fake_summary = {
            "duration_seconds": 2.0,
            "targets_processed": 1,
            "total_posts_scraped": 3,
            "events_extracted": 1,
            "extracted_titles": ["Sample Event"],
        }

        with (
            patch.object(settings, "PIPELINE_API_KEY", "inbound-secret-123"),
            patch.object(settings, "N8N_WEBHOOK_URL", ""),
            patch.object(settings, "N8N_API_KEY", ""),
            patch("app.api.v1.endpoints.scraper.run_pipeline_gateway", new=AsyncMock(return_value=fake_summary)),
            patch(
                "app.api.v1.endpoints.scraper.telegram_notifier.notify_pipeline_result",
                new=AsyncMock(return_value=True),
            ) as mock_tg_notify,
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                ok_res = await client.post(
                    "/api/v1/scraper/trigger?async_mode=true",
                    headers={"X-Api-Key": "inbound-secret-123"},
                    json={"trigger_source": "manual", "notify_n8n": True, "job_id": "job_tg_fallback"},
                )
                self.assertEqual(ok_res.status_code, 202)
                self.assertFalse(ok_res.json()["callback_configured"])

                status_res = await client.get(
                    "/api/v1/scraper/jobs/job_tg_fallback",
                    headers={"X-Api-Key": "inbound-secret-123"},
                )
                self.assertEqual(status_res.status_code, 200)
                self.assertEqual(status_res.json()["status"], "success")
                self.assertFalse(status_res.json()["n8n_notified"])
                self.assertTrue(status_res.json()["telegram_notified"])

                mock_tg_notify.assert_awaited_once()
                self.assertEqual(mock_tg_notify.call_args.kwargs["job_id"], "job_tg_fallback")

        job_store._jobs.pop("job_tg_fallback", None)


class TestEndpointProtection(unittest.IsolatedAsyncioTestCase):
    """Ensure all protected user, event, organizer, and server endpoints fail closed."""

    async def test_unauthenticated_requests_rejected_across_protected_endpoints(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Public health probe remains accessible
            health_res = await client.get("/api/v1/health")
            self.assertEqual(health_res.status_code, 200)

            protected_gets = [
                "/api/v1/events/categories",
                "/api/v1/events/explore",
                "/api/v1/events/past",
                "/api/v1/events/for-you",
                "/api/v1/events",
                "/api/v1/events/detail/ig:123",
                "/api/v1/events/verify-ticket?event_id=ig:123&ticket_code=ABC123",
                "/api/v1/events/rsvp?event_id=ig:123",
                "/api/v1/events/saved-scraped",
                "/api/v1/events/user-rsvps",
                "/api/v1/users/interests",
                "/api/v1/users/me",
                "/api/v1/users/search?query=test",
                "/api/v1/organizers/me",
                "/api/v1/organizers/check-username?username=paza",
                "/api/v1/organizers/events",
                "/api/v1/organizers/categories",
                "/api/v1/organizers/events/00000000-0000-0000-0000-000000000001/rsvps",
            ]
            for path in protected_gets:
                res = await client.get(path)
                self.assertEqual(res.status_code, 401, f"Expected 401 for unauthenticated GET {path}, got {res.status_code}")

            protected_posts = [
                ("/api/v1/users/interests", {"interest_slugs": ["music"]}),
                ("/api/v1/events/save-scraped", {"event_id": "ig:1", "event_data": {}}),
                ("/api/v1/events/rsvp", {"event_id": "ig:1", "first_name": "Test"}),
                ("/api/v1/organizers/events", {}),
                ("/api/v1/organizers/rsvps/confirm", {"event_id": "00000000-0000-0000-0000-000000000001", "telegram_id": 1}),
            ]
            for path, payload in protected_posts:
                res = await client.post(path, json=payload)
                self.assertEqual(res.status_code, 401, f"Expected 401 for unauthenticated POST {path}, got {res.status_code}")

    async def test_authenticated_clerk_token_allows_protected_event_route(self):
        priv, pub, _ = _generate_rsa_keypair()
        verifier = ClerkVerifier(jwt_key=pub)
        now = int(time.time())
        token = jwt.encode(
            {"sub": "user_auth_ok", "email": "member@paza.et", "exp": now + 300},
            priv,
            algorithm="RS256",
        )

        transport = ASGITransport(app=app)
        with (
            patch.object(security_module, "clerk_verifier", verifier),
            patch(
                "app.api.v1.endpoints.events.EventRepository.get_event_categories",
                new=AsyncMock(return_value=[]),
            ),
        ):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                unauth_res = await client.get("/api/v1/events/categories")
                self.assertEqual(unauth_res.status_code, 401)

                auth_res = await client.get(
                    "/api/v1/events/categories",
                    headers={"Authorization": f"Bearer {token}"},
                )
                self.assertEqual(auth_res.status_code, 200)
                self.assertEqual(auth_res.json(), [])

    async def test_legacy_jwt_empty_secret_rejected_and_google_requires_id_token(self):
        with patch.object(settings, "JWT_SECRET_KEY", ""):
            header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
            payload = base64.urlsafe_b64encode(
                json.dumps({"sub": "attacker", "exp": int(time.time()) + 300}).encode()
            ).decode().rstrip("=")
            import hmac as _hmac
            import hashlib as _hashlib
            sig = base64.urlsafe_b64encode(
                _hmac.new(b"", f"{header}.{payload}".encode(), _hashlib.sha256).digest()
            ).decode().rstrip("=")
            forged = f"{header}.{payload}.{sig}"
            self.assertIsNone(security_module.decode_access_token(forged))

        transport = ASGITransport(app=app)
        with patch.object(settings, "JWT_SECRET_KEY", "test-org-secret"):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.post(
                    "/api/v1/organizers/auth/google",
                    json={"google_id": "fake-id", "email": "victim@paza.et"},
                )
                self.assertEqual(res.status_code, 401)

    async def test_organizer_rsvp_idor_blocked(self):
        from types import SimpleNamespace
        from uuid import UUID
        from app.api.v1.endpoints.organizers import get_current_organizer_from_token
        from app.db.session import get_db

        priv, pub, _ = _generate_rsa_keypair()
        verifier = ClerkVerifier(jwt_key=pub)
        token = jwt.encode(
            {"sub": "user_org_1", "email": "org@paza.et", "exp": int(time.time()) + 300},
            priv,
            algorithm="RS256",
        )

        async def _fake_db():
            yield object()

        fake_org = SimpleNamespace(id=UUID("11111111-1111-1111-1111-111111111111"))
        app.dependency_overrides[get_current_organizer_from_token] = lambda: fake_org
        app.dependency_overrides[get_db] = _fake_db
        try:
            transport = ASGITransport(app=app)
            with (
                patch.object(security_module, "clerk_verifier", verifier),
                patch(
                    "app.api.v1.endpoints.organizers.EventRepository.get_organizer_event",
                    new=AsyncMock(return_value=None),
                ),
            ):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    headers = {"Authorization": f"Bearer {token}"}
                    r1 = await client.get(
                        "/api/v1/organizers/events/22222222-2222-2222-2222-222222222222/rsvps",
                        headers=headers,
                    )
                    self.assertEqual(r1.status_code, 404)

                    r2 = await client.post(
                        "/api/v1/organizers/rsvps/confirm",
                        headers=headers,
                        json={"event_id": "22222222-2222-2222-2222-222222222222", "telegram_id": 123},
                    )
                    self.assertEqual(r2.status_code, 404)
        finally:
            app.dependency_overrides.pop(get_current_organizer_from_token, None)
            app.dependency_overrides.pop(get_db, None)

    async def test_auth_middleware_denies_by_default_and_preserves_cors_and_uploads(self):
        priv, pub, _ = _generate_rsa_keypair()
        verifier = ClerkVerifier(jwt_key=pub)
        token = jwt.encode(
            {"sub": "user_mw_ok", "email": "mw@paza.et", "exp": int(time.time()) + 300},
            priv,
            algorithm="RS256",
        )

        transport = ASGITransport(app=app)
        with (
            patch.object(security_module, "clerk_verifier", verifier),
            patch(
                "app.api.v1.endpoints.events.s3_storage_service.upload_file",
                new=AsyncMock(return_value="https://paza-events-media.s3.amazonaws.com/rsvps/receipts/test.png"),
            ),
        ):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Unknown/unguarded path still rejected by global AuthEnforcementMiddleware
                unauth_probe = await client.get(
                    "/api/v1/_unguarded_future_route",
                    headers={"Origin": "https://paza.yab.et"},
                )
                self.assertEqual(unauth_probe.status_code, 401)
                self.assertEqual(unauth_probe.headers.get("access-control-allow-origin"), "https://paza.yab.et")

                # Static uploads require auth at middleware boundary too
                static_res = await client.get("/static/uploads/test.png")
                self.assertEqual(static_res.status_code, 401)

                # CORS preflight passes through cleanly
                preflight = await client.options(
                    "/api/v1/events/explore",
                    headers={
                        "Origin": "https://paza.yab.et",
                        "Access-Control-Request-Method": "GET",
                    },
                )
                self.assertEqual(preflight.status_code, 200)

                # Multipart receipt upload passes cleanly through AuthEnforcementMiddleware
                upload_res = await client.post(
                    "/api/v1/events/upload-receipt",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": ("receipt.png", b"png-bytes", "image/png")},
                )
                self.assertEqual(upload_res.status_code, 200)
                self.assertIn("s3.amazonaws.com", upload_res.json()["url"])


