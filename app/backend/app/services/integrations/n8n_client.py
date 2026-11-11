"""Modular n8n two-way API-key-protected webhook client and Telegram payload formatter."""

import asyncio
import html
import logging
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)


def format_pipeline_telegram_message(
    job_id: str,
    status: Literal["success", "failed"],
    summary: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    trigger_source: str = "n8n",
) -> str:
    """Format a pipeline job result into a clean Telegram HTML message."""
    safe_job_id = html.escape(str(job_id))
    safe_source = html.escape(str(trigger_source))

    if status == "failed":
        safe_error = html.escape((error or "Unknown pipeline error")[:600])
        return (
            "❌ <b>Paza Scraper Pipeline Failed</b>\n"
            f"• <b>Job ID:</b> <code>{safe_job_id}</code>\n"
            f"• <b>Triggered By:</b> {safe_source}\n"
            f"• <b>Error:</b> <code>{safe_error}</code>"
        )

    data = summary or {}
    titles = data.get("extracted_titles") or []
    titles_block = ""
    if titles:
        preview = "\n".join(f"  • {html.escape(str(t))}" for t in titles[:5])
        extra = f"\n  <i>+{len(titles) - 5} more</i>" if len(titles) > 5 else ""
        titles_block = f"\n\n📌 <b>Extracted Events:</b>\n{preview}{extra}"

    return (
        "✅ <b>Paza Scraper Pipeline Completed</b>\n"
        f"• <b>Job ID:</b> <code>{safe_job_id}</code>\n"
        f"• <b>Triggered By:</b> {safe_source}\n"
        f"• <b>Duration:</b> {data.get('duration_seconds', 0)}s\n"
        f"• <b>Targets Processed:</b> {data.get('targets_processed', 0)}\n"
        f"• <b>Posts Scraped:</b> {data.get('total_posts_scraped', 0)}\n"
        f"• <b>Events Extracted:</b> {data.get('events_extracted', 0)}\n"
        f"• <b>Passed Skipped / Cleaned:</b> "
        f"{data.get('passed_events_skipped', 0)} / {data.get('passed_events_cleaned', 0)}\n"
        f"• <b>Failures (Transcribe / LLM):</b> "
        f"{data.get('failed_transcriptions', 0)} / {data.get('failed_extractions', 0)}"
        f"{titles_block}"
    )


class N8nJobCallbackPayload(BaseModel):
    """Structured JSON payload sent from Paza Backend -> n8n Webhook."""

    job_id: str
    event_type: str
    status: Literal["success", "failed"]
    trigger_source: str = "n8n"
    triggered_at: str
    completed_at: str
    chat_id: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    telegram_message: str


class PipelineJobRecord(BaseModel):
    """In-memory job status record for tracking async pipeline runs."""

    job_id: str
    status: Literal["queued", "running", "success", "failed"] = "queued"
    trigger_source: str = "n8n"
    triggered_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    n8n_notified: Optional[bool] = None
    telegram_notified: Optional[bool] = None


class PipelineJobStore:
    """Bounded in-memory store tracking recent pipeline job executions."""

    def __init__(self, max_entries: int = 100):
        self._max_entries = max_entries
        self._jobs: "OrderedDict[str, PipelineJobRecord]" = OrderedDict()

    def create(self, job_id: str, trigger_source: str = "n8n") -> PipelineJobRecord:
        record = PipelineJobRecord(job_id=job_id, trigger_source=trigger_source)
        self._jobs[job_id] = record
        self._jobs.move_to_end(job_id)
        while len(self._jobs) > self._max_entries:
            self._jobs.popitem(last=False)
        return record

    def get(self, job_id: str) -> Optional[PipelineJobRecord]:
        return self._jobs.get(job_id)

    def mark_running(self, job_id: str) -> None:
        if job_id in self._jobs:
            self._jobs[job_id].status = "running"

    def mark_completed(
        self,
        job_id: str,
        status: Literal["success", "failed"],
        summary: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        n8n_notified: Optional[bool] = None,
        telegram_notified: Optional[bool] = None,
    ) -> Optional[PipelineJobRecord]:
        record = self._jobs.get(job_id)
        if not record:
            return None
        record.status = status
        record.completed_at = datetime.now(timezone.utc).isoformat()
        record.summary = summary
        record.error = error
        record.n8n_notified = n8n_notified
        record.telegram_notified = telegram_notified
        return record


class N8nWebhookClient:
    """Sends API-key-authenticated JSON callbacks from Backend -> n8n."""

    def __init__(
        self,
        webhook_url: Optional[str] = None,
        api_key: Optional[str] = None,
        api_key_header: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: int = 2,
    ):
        self._webhook_url_override = webhook_url
        self._api_key_override = api_key
        self._api_key_header_override = api_key_header
        self._timeout_override = timeout_seconds
        self._max_retries = max_retries

    @property
    def webhook_url(self) -> str:
        return (self._webhook_url_override if self._webhook_url_override is not None else settings.N8N_WEBHOOK_URL).strip()

    @property
    def api_key(self) -> str:
        return (self._api_key_override if self._api_key_override is not None else settings.N8N_API_KEY).strip()

    @property
    def api_key_header(self) -> str:
        header = self._api_key_header_override if self._api_key_header_override is not None else settings.N8N_API_KEY_HEADER
        return header.strip() or "X-Api-Key"

    @property
    def timeout_seconds(self) -> float:
        return self._timeout_override if self._timeout_override is not None else settings.N8N_WEBHOOK_TIMEOUT_SECONDS

    async def notify_pipeline_result(
        self,
        job_id: str,
        status: Literal["success", "failed"],
        triggered_at: str,
        trigger_source: str = "n8n",
        summary: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> bool:
        """Dispatch job completion JSON to n8n webhook authenticated with N8N_API_KEY."""
        target_url = (callback_url or self.webhook_url).strip()
        if not target_url:
            logger.info(f"Skipping n8n callback for job [{job_id}]: N8N_WEBHOOK_URL is not configured.")
            return False

        if not self.api_key:
            logger.error(
                f"Refusing outbound n8n callback for job [{job_id}]: "
                "N8N_API_KEY is not configured (two-way API key protection required)."
            )
            return False

        completed_at = datetime.now(timezone.utc).isoformat()
        telegram_message = format_pipeline_telegram_message(
            job_id=job_id,
            status=status,
            summary=summary,
            error=error,
            trigger_source=trigger_source,
        )
        payload = N8nJobCallbackPayload(
            job_id=job_id,
            event_type="scraper.pipeline.completed" if status == "success" else "scraper.pipeline.failed",
            status=status,
            trigger_source=trigger_source,
            triggered_at=triggered_at,
            completed_at=completed_at,
            chat_id=settings.TELEGRAM_CHAT_ID or None,
            summary=summary,
            error=error,
            telegram_message=telegram_message,
        )

        headers = {
            "Content-Type": "application/json",
            self.api_key_header: self.api_key,
        }

        for attempt in range(self._max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    resp = await client.post(target_url, json=payload.model_dump(), headers=headers)
                    if 200 <= resp.status_code < 300:
                        logger.info(f"Delivered n8n callback for job [{job_id}] -> HTTP {resp.status_code}")
                        return True
                    logger.warning(
                        f"n8n callback attempt {attempt + 1} for job [{job_id}] returned HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                    if resp.status_code < 500:
                        return False
            except Exception as exc:
                logger.warning(f"n8n callback attempt {attempt + 1} failed for job [{job_id}]: {exc}")

            if attempt < self._max_retries:
                await asyncio.sleep(1.0 * (attempt + 1))

        logger.error(f"Exhausted retries delivering n8n callback for job [{job_id}].")
        return False


job_store = PipelineJobStore()
n8n_client = N8nWebhookClient()

