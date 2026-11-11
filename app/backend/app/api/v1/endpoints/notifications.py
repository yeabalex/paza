"""Notification Endpoints — Protected API routes for event announcements & alerts."""

import html
import logging
import urllib.parse
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.security import require_api_key
from app.services.cache.redis_event_storage import RedisEventStorage

logger = logging.getLogger(__name__)
router = APIRouter()


def get_redis_storage() -> RedisEventStorage:
    return RedisEventStorage()


def format_event_datetime(dt_str: Optional[str]) -> Optional[str]:
    """Format ISO datetime string into human readable 'Thu, Aug 28 • 06:00 PM' format."""
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00").replace(" ", "T")
        dt = datetime.fromisoformat(clean_str)
        return dt.strftime("%a, %b %d • %I:%M %p")
    except Exception:
        return str(dt_str)


@router.post(
    "/broadcast-scraped",
    summary="Generate Event Announcement Card",
    description="Picks the latest extracted active event from Redis and formats it into an announcement payload.",
    dependencies=[Depends(require_api_key)]
)
async def broadcast_scraped_events(
    limit: int = Query(1, ge=1, le=5, description="Number of latest events to inspect"),
    redis_storage: RedisEventStorage = Depends(get_redis_storage),
):
    """Fetches active scraped events from Redis and generates announcement details."""
    try:
        raw_events = await redis_storage.get_all_active_events()
    except Exception as e:
        logger.error(f"Error fetching active Redis events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read events from Redis cache."
        )

    if not raw_events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active scraped events found in Redis cache."
        )

    raw_events.sort(key=lambda x: x.get("stored_at") or "", reverse=True)
    item = raw_events[0]
    evt_data = item.get("event", {}) if isinstance(item.get("event"), dict) else item

    raw_title = evt_data.get("title") or "Upcoming Addis Social Event"
    title = html.escape(raw_title.strip())

    venue_raw = evt_data.get("venue_name") or "Addis Ababa"
    sub_city = evt_data.get("sub_city")
    venue_display = f"{venue_raw}, {sub_city}" if (sub_city and sub_city.strip() and sub_city.lower() not in venue_raw.lower()) else venue_raw
    venue = html.escape(venue_display)

    fee_raw = evt_data.get("entrance_fee_etb")
    fee_str = f"{float(fee_raw):.0f} ETB" if fee_raw and float(fee_raw) > 0 else "FREE"
    date_str = format_event_datetime(evt_data.get("start_datetime"))

    platform = item.get("platform") or item.get("source_platform") or evt_data.get("source_platform") or "web"
    post_id = item.get("post_id") or item.get("source_message_id") or evt_data.get("source_message_id") or "1"
    event_id = f"{platform}:{post_id}" if not str(item.get("event_id", "")).startswith(f"{platform}:") else item.get("event_id")
    image_url = evt_data.get("image_url") or item.get("image_url")

    web_app_url = settings.WEB_APP_URL.rstrip("/")
    encoded_event_id = urllib.parse.quote(str(event_id), safe="")

    announcement = {
        "title": title,
        "date": date_str,
        "venue": venue,
        "entrance_fee": fee_str,
        "event_id": event_id,
        "image_url": image_url,
        "web_url": f"{web_app_url}/?event_id={encoded_event_id}",
    }

    logger.info(f"Event announcement prepared: {title} ({event_id})")

    return {
        "status": "success",
        "announcement": announcement
    }
