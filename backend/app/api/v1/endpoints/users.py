"""User Authentication, Profile & Interest Management API Endpoints for Web App."""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_web_user
from app.db.session import get_db
from app.schemas.user import (
    InterestSchema,
    InterestSelectionRequest,
    UserProfileSchema,
)
from app.services.user.user_repository import UserRepository

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/me",
    response_model=UserProfileSchema,
    summary="Get Current User Profile & Registration Status",
    description="Fetches or auto-provisions a user profile in PostgreSQL for the Web App."
)
async def get_current_user_profile(
    user_id: Optional[str] = Query(None, description="Web User identifier"),
    telegram_id: Optional[int] = Query(None, description="Numeric User ID for backwards compatibility"),
    username: Optional[str] = Query(None, description="User handle"),
    full_name: Optional[str] = Query(None, description="User full name"),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    """Verifies user ID, auto-creates or syncs user in DB, and returns profile."""
    # Resolve numeric user ID for database persistence
    target_id: int
    if telegram_id:
        target_id = telegram_id
    elif user_id:
        target_id = int(user_id) if user_id.isdigit() else abs(hash(user_id)) % (10**9)
    else:
        target_id = current_user.get("user_id", 999888777)

    sync_full_name = full_name or current_user.get("full_name") or "Web User"
    sync_username = username or current_user.get("username")

    try:
        user = await UserRepository.get_or_create_user(
            db=db,
            telegram_id=target_id,
            full_name=sync_full_name,
            username=sync_username,
            preferred_language="en",
            force_sync=True
        )

        profile = await UserRepository.get_user_profile(db, user.telegram_id)
    except Exception as e:
        logger.error(f"Database error fetching/provisioning profile for user_id={target_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable. Please try again."
        )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to retrieve user profile."
        )

    return profile


@router.get(
    "/interests",
    response_model=List[InterestSchema],
    summary="List All Available Normalized Interests",
    description="Returns all normalized categories/interests for selection."
)
async def list_all_interests(db: AsyncSession = Depends(get_db)):
    """Returns list of all normalized interests."""
    interests = await UserRepository.list_all_interests(db)
    return [InterestSchema.model_validate(i) for i in interests]


@router.post(
    "/interests",
    summary="Update User Selected Interests",
    description="Links user's selected interest slugs to their profile in user_interests table.",
)
async def update_user_interests(
    req: InterestSelectionRequest,
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates user's selected interests in normalized junction table."""
    target_id: int
    if req.telegram_id:
        target_id = req.telegram_id
    elif req.user_id:
        target_id = int(req.user_id) if req.user_id.isdigit() else abs(hash(req.user_id)) % (10**9)
    else:
        target_id = current_user.get("user_id", 999888777)

    matching_interests = await UserRepository.update_user_interests(db, target_id, req.interest_slugs)
    if matching_interests is None:
        # Create user on the fly if not created yet
        await UserRepository.get_or_create_user(
            db=db,
            telegram_id=target_id,
            full_name="Web User",
            username=None,
            preferred_language="en"
        )
        matching_interests = await UserRepository.update_user_interests(db, target_id, req.interest_slugs)

    return {
        "message": f"Successfully updated {len(matching_interests or [])} interests for user.",
        "user_id": target_id,
        "selected_slugs": [i.slug for i in (matching_interests or [])]
    }


class UserSearchResult(BaseModel):
    id: Optional[str] = None
    telegram_id: int
    full_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


@router.get(
    "/search",
    response_model=List[UserSearchResult],
    summary="Search Registered Users by Username or Name",
    description="Debounced search endpoint for finding users to invite.",
)
async def search_users(
    query: str = Query(..., min_length=1, description="Username or full name query"),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    clean_q = query.strip().lstrip("@").lower()
    if not clean_q:
        return []

    try:
        from app.db.models import User
        from sqlalchemy import select, or_, and_, func

        stmt = (
            select(User)
            .where(
                or_(
                    and_(
                        User.username.isnot(None),
                        func.length(User.username) > 0,
                        User.username.ilike(f"%{clean_q}%"),
                    ),
                    and_(
                        User.full_name.isnot(None),
                        func.length(User.full_name) > 0,
                        User.full_name.ilike(f"%{clean_q}%"),
                    ),
                )
            )
            .limit(10)
        )
        res = await db.execute(stmt)
        users = res.scalars().all()
        return [
            UserSearchResult(
                id=str(u.id),
                telegram_id=u.telegram_id,
                full_name=u.full_name or u.username or "User",
                username=u.username if u.username else None,
                photo_url=None,
            )
            for u in users
        ]
    except Exception as e:
        logger.error(f"Error searching users: {e}")
        return []
