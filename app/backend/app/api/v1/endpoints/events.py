"""Event Endpoints Controller — Thin FastAPI Router delegating to EventRepository."""

import logging
import httpx
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_web_user, require_api_key
from app.db.session import get_db
from app.services.cache.redis_event_storage import RedisEventStorage
from app.services.event.event_repository import EventRepository
from app.services.storage import s3_storage_service
from app.schemas.event import (
    CategoryInfo,
    EventDetailSchema,
    EventResponseSchema,
    EventSummarySchema,
    RsvpRequest,
    RsvpUserSchema,
    SaveScrapedEventRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()
redis_event_storage = RedisEventStorage()


# ════════════════════════════════════════════════════════════════════════════════
# AUTHENTICATED USER READ ENDPOINTS (Clerk / Bearer JWT required)
# ════════════════════════════════════════════════════════════════════════════════

@router.get(
    "/categories",
    response_model=List[CategoryInfo],
    summary="List available event categories with counts",
    dependencies=[Depends(get_current_web_user)],
)
async def list_event_categories():
    """Returns categories that have at least one active event, sorted by count."""
    try:
        return await EventRepository.get_event_categories(redis_event_storage)
    except Exception as e:
        logger.error(f"Failed to fetch categories from Redis: {e}")
        return []


@router.get(
    "/explore",
    response_model=List[EventResponseSchema],
    summary="List Scraped Social Media Events (Explore Tab)",
    description="Fetches scraped Instagram/TikTok/Telegram events directly from Redis cache. Filter by timeframe ('upcoming', 'past', or 'all').",
    dependencies=[Depends(get_current_web_user)],
)
async def list_explore_scraped_events(
    category: Optional[str] = Query(None, description="Filter events by category slug"),
    timeframe: str = Query("upcoming", description="Filter timeframe: 'upcoming' (default), 'past', or 'all'"),
    skip: int = Query(0, ge=0, description="Number of events to skip"),
    limit: int = Query(7, ge=1, le=50, description="Max events per page"),
):
    """Returns scraped events from Redis cache for Explore tab, with pagination and timeframe filtering."""
    try:
        return await EventRepository.list_explore_scraped_events(
            redis_storage=redis_event_storage,
            category=category,
            skip=skip,
            limit=limit,
            timeframe=timeframe,
        )
    except Exception as e:
        logger.error(f"Failed to fetch explore events from Redis: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis cache service error: {str(e)}"
        )


@router.get(
    "/past",
    response_model=List[EventResponseSchema],
    summary="List Past/Concluded Social Media Events",
    description="Convenience endpoint returning past scraped events from Redis cache.",
    dependencies=[Depends(get_current_web_user)],
)
async def list_past_scraped_events(
    category: Optional[str] = Query(None, description="Filter events by category slug"),
    skip: int = Query(0, ge=0, description="Number of events to skip"),
    limit: int = Query(7, ge=1, le=50, description="Max events per page"),
):
    """Returns past scraped events from Redis cache."""
    try:
        return await EventRepository.list_explore_scraped_events(
            redis_storage=redis_event_storage,
            category=category,
            skip=skip,
            limit=limit,
            timeframe="past",
        )
    except Exception as e:
        logger.error(f"Failed to fetch past events from Redis: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis cache service error: {str(e)}"
        )


@router.get(
    "/for-you",
    response_model=List[EventResponseSchema],
    summary="List Platform Organizer Events (For You Tab)",
    description="Fetches verified organizer-posted events from PostgreSQL filtered by user interests.",
    dependencies=[Depends(get_current_web_user)],
)
async def list_for_you_organizer_events(
    telegram_id: Optional[int] = Query(None, description="Telegram user ID"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    db: AsyncSession = Depends(get_db)
):
    """Returns verified platform organizer events from PostgreSQL for For You tab."""
    try:
        return await EventRepository.list_organizer_events(db=db, category=category)
    except Exception as e:
        logger.error(f"Failed to fetch organizer events from PostgreSQL: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"PostgreSQL database error: {str(e)}"
        )


@router.get(
    "",
    response_model=List[EventResponseSchema],
    summary="List All Active Events",
    description="Combines scraped events from Redis and platform events from PostgreSQL.",
    dependencies=[Depends(get_current_web_user)],
)
async def list_all_active_events(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    db: AsyncSession = Depends(get_db)
):
    """Combines explore scraped events and organizer events."""
    try:
        scraped = await EventRepository.list_explore_scraped_events(
            redis_storage=redis_event_storage,
            category=category,
            skip=0,
            limit=50,
            timeframe="upcoming",
        )
    except Exception as e:
        logger.warning(f"Failed to fetch scraped events in combined feed: {e}")
        scraped = []

    organizer = await EventRepository.list_organizer_events(db=db, category=category)
    return scraped + organizer


@router.get(
    "/detail/{event_id:path}",
    response_model=EventDetailSchema,
    summary="Get Full Event Details",
    description="Fetches full details including description and images for a specific event ID.",
    dependencies=[Depends(get_current_web_user)],
)
async def get_event_detail(
    event_id: str,
    db: AsyncSession = Depends(get_db)
):
    detail = await EventRepository.get_event_detail(
        db=db, redis_storage=redis_event_storage, event_id=event_id
    )
    if detail:
        return detail

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event detail not found")


@router.get(
    "/verify-ticket",
    response_model=dict,
    summary="Verify Digital Entry Ticket Pass",
    description="Validates a ticket by event_id and ticket_code for door authentication.",
    dependencies=[Depends(get_current_web_user)],
)
async def verify_ticket(
    event_id: str = Query(...),
    ticket_code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await EventRepository.verify_ticket(
            db=db,
            redis_storage=redis_event_storage,
            event_id=event_id,
            ticket_code=ticket_code
        )
    except Exception as e:
        logger.error(f"Error verifying ticket: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get(
    "/rsvp",
    response_model=List[RsvpUserSchema],
    summary="List all RSVPs for an event",
    dependencies=[Depends(get_current_web_user)],
)
async def list_rsvps(
    event_id: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await EventRepository.list_rsvps(db=db, event_id=event_id)
    except Exception as e:
        logger.error(f"Failed to list RSVPs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


# ════════════════════════════════════════════════════════════════════════════════
# USER-ACTION ENDPOINTS (Web User)
# ════════════════════════════════════════════════════════════════════════════════

def _resolve_target_user_id(current_user: dict, _requested_telegram_id: Optional[int] = None) -> int:
    """Always derive numeric user ID from verified JWT claims (preventing client ID spoofing)."""
    return int(current_user["user_id"])


@router.post(
    "/save-scraped",
    summary="Save Scraped Event to PostgreSQL DB",
    description="Stores a scraped event as raw JSON in permanent PostgreSQL storage for a user."
)
async def save_scraped_event(
    payload: SaveScrapedEventRequest,
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_id = _resolve_target_user_id(current_user, payload.telegram_id)
        await EventRepository.save_scraped_event(
            db=db,
            telegram_id=target_id,
            event_id=payload.event_id,
            event_data=payload.event_data,
        )
        return {"status": "success", "message": "Scraped event saved to DB"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save scraped event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.delete(
    "/save-scraped",
    summary="Un-save Scraped Event from PostgreSQL DB",
)
async def remove_saved_scraped_event(
    event_id: str = Query(...),
    telegram_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_id = _resolve_target_user_id(current_user, telegram_id)
        removed = await EventRepository.remove_saved_scraped_event(
            db=db, telegram_id=target_id, event_id=event_id
        )
        if removed:
            return {"status": "success", "message": "Event removed from DB"}
        return {"status": "not_found", "message": "Event was not saved"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to remove saved scraped event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get(
    "/saved-scraped",
    response_model=List[dict],
    summary="Get User's Saved Scraped Events from PostgreSQL DB",
)
async def get_saved_scraped_events(
    telegram_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_id = _resolve_target_user_id(current_user, telegram_id)
        return await EventRepository.get_saved_scraped_events(db=db, telegram_id=target_id)
    except Exception as e:
        logger.error(f"Failed to fetch saved scraped events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get(
    "/user-rsvps",
    response_model=List[dict],
    summary="Get User's RSVP'd Events from PostgreSQL DB",
)
async def get_user_rsvps(
    telegram_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_id = _resolve_target_user_id(current_user, telegram_id)
        return await EventRepository.get_user_rsvps(db=db, redis_storage=redis_event_storage, telegram_id=target_id)
    except Exception as e:
        logger.error(f"Failed to fetch user rsvp events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


# ════════════════════════════════════════════════════════════════════════════════
# RSVP ("Going") ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════════

@router.post(
    "/rsvp",
    summary="Mark user as Going to an event",
    description="Creates or updates an RSVP for the given event.",
)
async def mark_going(
    body: RsvpRequest,
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        body.telegram_id = _resolve_target_user_id(current_user, body.telegram_id)
        await EventRepository.mark_rsvp(db=db, body=body)
        return {"status": "success", "message": "RSVP saved"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save RSVP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.delete(
    "/rsvp",
    summary="Remove user's RSVP from an event",
)
async def remove_going(
    event_id: str = Query(...),
    telegram_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_id = _resolve_target_user_id(current_user, telegram_id)
        removed = await EventRepository.remove_rsvp(
            db=db, event_id=event_id, telegram_id=target_id
        )
        if removed:
            return {"status": "success", "message": "RSVP removed"}
        return {"status": "not_found", "message": "RSVP was not found"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to remove RSVP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post(
    "/upload-receipt",
    summary="Upload RSVP Payment Receipt Screenshot",
    description="Uploads RSVP payment receipt screenshot to AWS S3 storage."
)
async def upload_rsvp_receipt(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_web_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be an image (JPEG, PNG, WebP).",
        )
    try:
        url = await s3_storage_service.upload_file(file=file, folder="rsvps/receipts")
        return {"url": url}
    except Exception as e:
        logger.error(f"Error uploading RSVP receipt image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload receipt screenshot: {str(e)}"
        )


@router.post(
    "/send-invite",
    summary="Generate Event Invite with Artwork for Web Sharing",
    description="Uploads generated invite artwork image and creates shareable web invite link."
)
async def send_event_invite(
    event_id: str = Form(...),
    inviter_name: str = Form(...),
    inviter_username: Optional[str] = Form(None),
    invitee_telegram_id: Optional[int] = Form(None),
    invitee_username: Optional[str] = Form(None),
    vibe: Optional[str] = Form("casual"),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        import urllib.parse
        clean_id = urllib.parse.unquote(str(event_id)).strip()

        # 1. Fetch event details for title and venue
        evt_detail = await EventRepository.get_event_detail(db=db, redis_storage=redis_event_storage, event_id=clean_id)
        event_title = evt_detail.title if evt_detail else "Event"
        venue_name = evt_detail.venue_name if evt_detail else "Addis Ababa"

        # 2. Upload artwork image if provided
        image_url = None
        if image:
            try:
                image_url = await s3_storage_service.upload_file(file=image, folder="invites")
            except Exception as upload_err:
                logger.error(f"Failed to upload invite artwork image: {upload_err}")

        # 3. Build Web App Share Link
        web_app_url = settings.WEB_APP_URL.rstrip('/')
        invite_link = f"{web_app_url}/?event_id={urllib.parse.quote(clean_id)}"

        return {
            "status": "success",
            "message": f"Invite artwork ready for {inviter_name}!",
            "invite_url": invite_link,
            "image_url": image_url,
            "event_title": event_title,
            "venue_name": venue_name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending event invite: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invite: {str(e)}"
        )


# ════════════════════════════════════════════════════════════════════════════════
# SERVER-TO-SERVER MAINTENANCE ENDPOINTS (API Key required)
# ════════════════════════════════════════════════════════════════════════════════

@router.post(
    "/cleanup",
    summary="Clean up passed events from Redis cache",
    description="Removes concluded events from Redis. Requires X-Api-Key header.",
    dependencies=[Depends(require_api_key)],
)
async def cleanup_passed_events(
    max_age_days: int = Query(7, description="Delete passed events older than this many days (0 deletes all passed events)"),
):
    """Trigger cleanup of past events from Redis."""
    try:
        summary = await redis_event_storage.cleanup_passed_events(max_age_days=max_age_days)
        return {
            "status": "success",
            "message": f"Cleaned up {summary.get('cleaned_count', 0)} passed events (older than {max_age_days}d). {summary.get('remaining_count', 0)} active events remain.",
            "data": summary
        }
    except Exception as e:
        logger.error(f"Error during events cleanup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clean up events: {str(e)}"
        )

