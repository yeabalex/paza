"""Direct Telegram Bot notifier restricted to the configured admin chat ID."""

import logging
from typing import Any, Dict, Literal, Optional

import httpx

from app.core.config import settings
from app.services.integrations.n8n_client import format_pipeline_telegram_message

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE_URL = "https://api.telegram.org"


class TelegramBotNotifier:
    """Sends pipeline execution results via Telegram Bot API to a single configured user."""

    def __init__(
        self,
        bot_token: Optional[str] = None,
        allowed_chat_id: Optional[str] = None,
        timeout_seconds: float = 15.0,
    ):
        self._bot_token_override = bot_token
        self._allowed_chat_id_override = allowed_chat_id
        self._timeout_seconds = timeout_seconds

    @property
    def bot_token(self) -> str:
        return (self._bot_token_override if self._bot_token_override is not None else settings.TELEGRAM_BOT_TOKEN).strip()

    @property
    def allowed_chat_id(self) -> str:
        return str(self._allowed_chat_id_override if self._allowed_chat_id_override is not None else settings.TELEGRAM_CHAT_ID).strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token and self.allowed_chat_id)

    async def send_message(self, text: str, chat_id: Optional[str] = None) -> bool:
        """Send an HTML message strictly to the configured TELEGRAM_CHAT_ID."""
        if not self.is_configured:
            logger.info("Skipping direct Telegram notification: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.")
            return False

        target_chat_id = str(chat_id).strip() if chat_id is not None else self.allowed_chat_id
        if target_chat_id != self.allowed_chat_id:
            logger.warning(f"Blocked Telegram send attempt to unauthorized chat_id={target_chat_id}.")
            return False

        url = f"{TELEGRAM_API_BASE_URL}/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.allowed_chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                resp = await client.post(url, json=payload)
                if 200 <= resp.status_code < 300:
                    logger.info(f"Sent Telegram pipeline result to chat_id={self.allowed_chat_id}")
                    return True
                logger.error(f"Telegram API error HTTP {resp.status_code}: {resp.text[:300]}")
                return False
        except Exception as exc:
            logger.error(f"Failed sending Telegram notification: {exc}")
            return False

    async def notify_pipeline_result(
        self,
        job_id: str,
        status: Literal["success", "failed"],
        trigger_source: str = "pipeline",
        summary: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> bool:
        """Format and deliver a pipeline run summary to the authorized Telegram user."""
        text = format_pipeline_telegram_message(
            job_id=job_id,
            status=status,
            summary=summary,
            error=error,
            trigger_source=trigger_source,
        )
        return await self.send_message(text=text)


telegram_notifier = TelegramBotNotifier()

