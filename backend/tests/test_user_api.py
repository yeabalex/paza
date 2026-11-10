#!/usr/bin/env python3
"""Integration Test Script for User Registration & Interest Selection API Endpoints (Web App)."""

import asyncio
import logging
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from app.main import app
from app.db.session import AsyncSessionLocal
from app.db.models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestUserAPI")


async def main():
    print("=" * 80)
    print("      TESTING WEB USER PROFILE & INTEREST SELECTION ENDPOINTS")
    print("=" * 80)

    test_user_id = 999888777

    # Cleanup test user from previous runs
    async with AsyncSessionLocal() as session:
        await session.execute(delete(User).where(User.telegram_id == test_user_id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Listing Interests
        res_int = await client.get("/api/v1/users/interests")
        print(f"\n1. GET /api/v1/users/interests -> Status {res_int.status_code}")
        interests = res_int.json()
        assert res_int.status_code == 200

        # 2. Test Web User /me profile provision
        res_me = await client.get(
            f"/api/v1/users/me?user_id={test_user_id}&full_name=Yeabsira+TestUser&username=yeabsira_test"
        )
        print(f"\n2. GET /api/v1/users/me -> Status {res_me.status_code}")
        user_data = res_me.json()
        assert res_me.status_code == 200
        assert user_data.get("full_name") == "Yeabsira TestUser"

        # 3. Test Interest Selection
        res_sel = await client.post(
            "/api/v1/users/interests",
            json={
                "telegram_id": test_user_id,
                "interest_slugs": ["music", "tech", "nightlife"]
            }
        )
        print(f"\n3. POST /api/v1/users/interests -> Status {res_sel.status_code}")
        assert res_sel.status_code == 200

        print("\n✅ All Web User API tests passed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
