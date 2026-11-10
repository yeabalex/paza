"""Admin Notification Service — Web & System notifications."""

import logging

logger = logging.getLogger(__name__)


async def notify_admin(text: str) -> bool:
    """Logs system events and notifies admin."""
    logger.info(f"[ADMIN NOTIFICATION] {text}")
    return True
