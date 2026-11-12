"""User Repository Service — Encapsulates Database operations for Users & Interests."""

import logging
from typing import List, Optional
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import deterministic_numeric_id
from app.db.models import User, Interest, UserInterest, UserRole
from app.schemas.user import UserProfileSchema, InterestSchema

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository handling all database queries for User management and Interest linking."""

    @staticmethod
    async def get_total_users_count(db: AsyncSession) -> int:
        """Count total registered users in PostgreSQL DB."""
        from sqlalchemy import func
        stmt = select(func.count()).select_from(User)
        res = await db.execute(stmt)
        return res.scalar() or 0

    @staticmethod
    async def get_by_telegram_id(db: AsyncSession, telegram_id: int) -> Optional[User]:
        """Fetch user by Telegram ID."""
        stmt = select(User).where(User.telegram_id == telegram_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_by_clerk_id(db: AsyncSession, clerk_id: str) -> Optional[User]:
        """Fetch user by Clerk ID."""
        stmt = select(User).where(User.clerk_id == clerk_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_or_create_by_clerk_id(
        db: AsyncSession,
        clerk_id: str,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        username: Optional[str] = None,
        preferred_language: str = "en",
        prefetched_user: Optional[User] = None,
    ) -> User:
        """Fetch or provision a PostgreSQL User from a verified Clerk identity."""
        clean_email = email.lower().strip() if email else None
        user = prefetched_user or await UserRepository.get_by_clerk_id(db, clerk_id)

        numeric_id = deterministic_numeric_id(clerk_id)

        def _sync_fields(target_user: User) -> bool:
            changed = False
            if target_user.clerk_id != clerk_id:
                target_user.clerk_id = clerk_id
                changed = True
            if not target_user.telegram_id:
                target_user.telegram_id = numeric_id
                changed = True
            if clean_email and target_user.email != clean_email:
                target_user.email = clean_email
                changed = True
            if full_name and target_user.full_name != full_name:
                target_user.full_name = full_name
                changed = True
            if username and target_user.username != username:
                target_user.username = username
                changed = True
            if preferred_language and target_user.preferred_language != preferred_language:
                target_user.preferred_language = preferred_language
                changed = True
            return changed

        if not user and clean_email:
            email_stmt = select(User).where(User.email == clean_email)
            email_res = await db.execute(email_stmt)
            candidate = email_res.scalar_one_or_none()
            if candidate:
                user = candidate

        needs_write = False
        if not user:
            user = User(
                clerk_id=clerk_id,
                telegram_id=numeric_id,
                email=clean_email,
                full_name=full_name,
                username=username,
                preferred_language=preferred_language,
                role=UserRole.USER,
            )
            db.add(user)
            needs_write = True
            logger.info(f"Provisioned new Clerk user [{clerk_id}] (numeric_id={numeric_id})")
        else:
            needs_write = _sync_fields(user)

        if needs_write:
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                existing = await UserRepository.get_by_clerk_id(db, clerk_id)
                if not existing and clean_email:
                    email_res = await db.execute(select(User).where(User.email == clean_email))
                    existing = email_res.scalar_one_or_none()
                if not existing:
                    existing = await UserRepository.get_by_telegram_id(db, numeric_id)
                if not existing:
                    raise
                if _sync_fields(existing):
                    await db.commit()
                user = existing
            await db.refresh(user)

        return user

    @staticmethod
    async def get_or_create_user(
        db: AsyncSession,
        telegram_id: int,
        full_name: Optional[str] = None,
        username: Optional[str] = None,
        preferred_language: str = "en",
        force_sync: bool = False
    ) -> User:
        """Create or update user upon Web App login."""
        user = await UserRepository.get_by_telegram_id(db, telegram_id)
        if not user:
            user = User(
                telegram_id=telegram_id,
                full_name=full_name,
                username=username,
                preferred_language=preferred_language,
                role=UserRole.USER
            )
            db.add(user)
            logger.info(f"Registered new user [{telegram_id}]: name='{full_name}', username='{username}'")
        else:
            updated = False
            # Sync full_name if provided and changed
            if full_name is not None and user.full_name != full_name:
                user.full_name = full_name
                updated = True

            # Sync username if changed (handles username added, modified, or removed)
            if force_sync or username is not None:
                if user.username != username:
                    user.username = username
                    updated = True

            if preferred_language and user.preferred_language != preferred_language:
                user.preferred_language = preferred_language
                updated = True

            if updated:
                logger.info(f"Synced updated Telegram profile for user [{telegram_id}]: name='{user.full_name}', username='{user.username}'")

        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_phone_number(db: AsyncSession, telegram_id: int, phone_number: str) -> Optional[User]:
        """Update user phone number upon contact sharing."""
        user = await UserRepository.get_by_telegram_id(db, telegram_id)
        if not user:
            return None

        user.phone_number = phone_number
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def list_all_interests(db: AsyncSession) -> List[Interest]:
        """List all normalized interests ordered by slug."""
        stmt = select(Interest).order_by(Interest.slug)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def update_user_interests(db: AsyncSession, telegram_id: int, interest_slugs: List[str]) -> Optional[List[Interest]]:
        """Link selected interest slugs to user in user_interests junction table."""
        user = await UserRepository.get_by_telegram_id(db, telegram_id)
        if not user:
            user = await UserRepository.get_or_create_user(db, telegram_id=telegram_id)

        # Fetch matching interest records
        int_stmt = select(Interest).where(Interest.slug.in_(interest_slugs))
        int_res = await db.execute(int_stmt)
        matching_interests = list(int_res.scalars().all())

        # Clear existing selections
        del_stmt = delete(UserInterest).where(UserInterest.user_id == user.id)
        await db.execute(del_stmt)

        # Insert new selections
        for interest in matching_interests:
            ui = UserInterest(user_id=user.id, interest_id=interest.id)
            db.add(ui)

        await db.commit()
        logger.info(f"Updated interests for user [{telegram_id}]: {[i.slug for i in matching_interests]}")
        return matching_interests

    @staticmethod
    async def build_user_profile(db: AsyncSession, user: User) -> UserProfileSchema:
        """Build UserProfileSchema for an existing User ORM instance."""
        ui_stmt = (
            select(Interest)
            .join(UserInterest, UserInterest.interest_id == Interest.id)
            .where(UserInterest.user_id == user.id)
        )
        ui_res = await db.execute(ui_stmt)
        selected_interests = list(ui_res.scalars().all())

        return UserProfileSchema(
            id=user.id,
            clerk_id=user.clerk_id,
            telegram_id=user.telegram_id,
            email=user.email,
            full_name=user.full_name,
            username=user.username,
            phone_number=user.phone_number,
            preferred_language=user.preferred_language,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            is_registered=True,
            interests=[InterestSchema.model_validate(i) for i in selected_interests],
        )

    @staticmethod
    async def get_user_profile(db: AsyncSession, telegram_id: int) -> Optional[UserProfileSchema]:
        """Build UserProfileSchema including selected interests."""
        user = await UserRepository.get_by_telegram_id(db, telegram_id)
        if not user:
            return None
        return await UserRepository.build_user_profile(db, user)
