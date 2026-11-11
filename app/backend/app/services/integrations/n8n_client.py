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


def _format_error_logs_block(error_logs: Optional[list]) -> str:
    """Format concise, HTML-escaped failure log lines for Telegram alerts."""
    cleaned = [str(item).strip() for item in (error_logs or []) if str(item).strip()]
    if not cleaned:
        return ""
    lines = [f"  • <code>{html.escape(entry[:220])}</code>" for entry in cleaned[:6]]
    if len(cleaned) > 6:
        lines.append(f"  <i>+{len(cleaned) - 6} more errors (check backend logs)</i>")
    return "\n\n⚠️ <b>Failure Logs:</b>\n" + "\n".join(lines)


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
    data = summary or {}
    logs_block = _format_error_logs_block(data.get("error_logs"))

    if status == "failed":
        safe_error = html.escape((error or "Unknown pipeline error")[:800])
        return (
            "❌ <b>Paza Scraper Pipeline Failed</b>\n"
            f"• <b>Job ID:</b> <code>{safe_job_id}</code>\n"
            f"• <b>Triggered By:</b> {safe_source}\n"
            f"• <b>Error:</b> <code>{safe_error}</code>"
            f"{logs_block}"
        )

    titles = data.get("extracted_titles") or []
    titles_block = ""
    if titles:
        preview = "\n".join(f"  • {html.escape(str(t))}" for t in titles[:5])
        extra = f"\n  <i>+{len(titles) - 5} more</i>" if len(titles) > 5 else ""
        titles_block = f"\n\n📌 <b>Extracted Events:</b>\n{preview}{extra}"

    failed_transcriptions = data.get("failed_transcriptions", 0)
    failed_extractions = data.get("failed_extractions", 0)
    has_warnings = bool(logs_block or failed_transcriptions or failed_extractions)
    header = (
        "⚠️ <b>Paza Scraper Pipeline Completed (With Errors)</b>"
        if has_warnings
        else "✅ <b>Paza Scraper Pipeline Completed</b>"
    )

    return (
        f"{header}\n"
        f"• <b>Job ID:</b> <code>{safe_job_id}</code>\n"
        f"• <b>Triggered By:</b> {safe_source}\n"
        f"• <b>Duration:</b> {data.get('duration_seconds', 0)}s\n"
        f"• <b>Targets Processed:</b> {data.get('targets_processed', 0)}\n"
        f"• <b>Posts Scraped:</b> {data.get('total_posts_scraped', 0)}\n"
        f"• <b>Events Extracted:</b> {data.get('events_extracted', 0)}\n"
        f"• <b>Passed Skipped / Cleaned:</b> "
        f"{data.get('passed_events_skipped', 0)} / {data.get('passed_events_cleaned', 0)}\n"
        f"• <b>Failures (Transcribe / LLM):</b> "
        f"{failed_transcriptions} / {failed_extractions}"
        f"{titles_block}"
        f"{logs_block}"
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
        self.last_error: Optional[str] = None

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
        self.last_error = None
        target_url = (callback_url or self.webhook_url).strip()
        if not target_url:
            self.last_error = "N8N_WEBHOOK_URL is not configured."
            logger.info(f"Skipping n8n callback for job [{job_id}]: N8N_WEBHOOK_URL is not configured.")
            return False

        if not self.api_key:
            self.last_error = "N8N_API_KEY is not configured."
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
                    self.last_error = f"HTTP {resp.status_code}: {resp.text[:160]}"
                    logger.warning(
                        f"n8n callback attempt {attempt + 1} for job [{job_id}] returned HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                    if resp.status_code < 500:
                        return False
            except Exception as exc:
                err_detail = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
                self.last_error = err_detail
                logger.warning(f"n8n callback attempt {attempt + 1} failed for job [{job_id}]: {err_detail}")

            if attempt < self._max_retries:
                await asyncio.sleep(1.0 * (attempt + 1))

        logger.error(f"Exhausted retries delivering n8n callback for job [{job_id}].")
        return False


job_store = PipelineJobStore()
n8n_client = N8nWebhookClient()

