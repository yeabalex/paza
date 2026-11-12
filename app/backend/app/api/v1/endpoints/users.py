"""User Authentication, Profile & Interest Management API Endpoints for Web App."""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clerk import clerk_verifier
from app.core.security import deterministic_numeric_id, get_current_web_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.user import (
    InterestSchema,
    InterestSelectionRequest,
    UserProfileSchema,
)
from app.services.user.user_repository import UserRepository

logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve_or_provision_web_user(
    db: AsyncSession,
    current_user: dict,
    user_id: Optional[str] = None,
    telegram_id: Optional[int] = None,
    username: Optional[str] = None,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
) -> User:
    """Resolve or provision the PostgreSQL User from Clerk claims or fallback guest/header identity."""
    if current_user.get("auth_provider") == "clerk":
        clerk_id = current_user["clerk_id"]
        resolved_email = current_user.get("email") or email
        resolved_name = current_user.get("full_name") or full_name
        resolved_username = current_user.get("username") or username

        existing_user = await UserRepository.get_by_clerk_id(db, clerk_id)
        if existing_user:
            resolved_email = resolved_email or existing_user.email
            resolved_name = resolved_name or existing_user.full_name
            resolved_username = resolved_username or existing_user.username

        if not resolved_email or not resolved_name:
            clerk_profile = await clerk_verifier.fetch_user_profile(clerk_id)
            if clerk_profile:
                resolved_email = resolved_email or clerk_profile.get("email")
                resolved_name = resolved_name or clerk_profile.get("full_name")
                resolved_username = resolved_username or clerk_profile.get("username")

        return await UserRepository.get_or_create_by_clerk_id(
            db=db,
            clerk_id=clerk_id,
            email=resolved_email,
            full_name=resolved_name or "Web User",
            username=resolved_username,
            preferred_language="en",
            prefetched_user=existing_user,
        )

    target_id = int(current_user["user_id"])
    sync_full_name = full_name or current_user.get("full_name") or "Web User"
    sync_username = username or current_user.get("username")
    return await UserRepository.get_or_create_user(
        db=db,
        telegram_id=target_id,
        full_name=sync_full_name,
        username=sync_username,
        preferred_language="en",
        force_sync=True,
    )


@router.get(
    "/me",
    response_model=UserProfileSchema,
    summary="Get Current User Profile & Registration Status",
    description="Verifies Bearer JWT identity, provisions/syncs user in PostgreSQL, and returns profile."
)
async def get_current_user_profile(
    user_id: Optional[str] = Query(None, description="Web User identifier (legacy fallback)"),
    telegram_id: Optional[int] = Query(None, description="Numeric User ID for backwards compatibility"),
    username: Optional[str] = Query(None, description="User handle"),
    full_name: Optional[str] = Query(None, description="User full name"),
    email: Optional[str] = Query(None, description="User email"),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    """Verifies user identity, auto-creates or syncs user in DB, and returns profile."""
    try:
        user = await _resolve_or_provision_web_user(
            db=db,
            current_user=current_user,
            user_id=user_id,
            telegram_id=telegram_id,
            username=username,
            full_name=full_name,
            email=email,
        )
        profile = await UserRepository.build_user_profile(db, user)
    except Exception as e:
        logger.error(f"Database error fetching/provisioning profile: {e}")
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
    description="Returns all normalized categories/interests for selection. Requires Bearer token.",
    dependencies=[Depends(get_current_web_user)],
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
    user = await _resolve_or_provision_web_user(
        db=db,
        current_user=current_user,
        user_id=req.user_id,
        telegram_id=req.telegram_id,
    )
    target_id = user.telegram_id or deterministic_numeric_id(str(user.id))
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
                telegram_id=u.telegram_id if u.telegram_id is not None else deterministic_numeric_id(str(u.id)),
                full_name=u.full_name or u.username or "User",
                username=u.username if u.username else None,
                photo_url=None,
            )
            for u in users
        ]
    except Exception as e:
        logger.error(f"Error searching users: {e}")
        return []
