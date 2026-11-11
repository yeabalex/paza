"""Scraper & Pipeline Trigger Endpoint with two-way n8n API-key webhook integration."""

import logging
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import require_api_key
from app.services.pipeline_gateway import run_pipeline_gateway
from app.services.cache.redis_event_storage import RedisEventStorage
from app.services.integrations import PipelineJobRecord, job_store, n8n_client, telegram_notifier

logger = logging.getLogger(__name__)
router = APIRouter()


class TriggerRequest(BaseModel):
    callback_url: Optional[str] = None
    trigger_source: str = "n8n"
    notify_n8n: bool = True
    job_id: Optional[str] = None


class TriggerResponse(BaseModel):
    message: str
    status: str
    mode: str
    job_id: str
    callback_configured: bool = False


class CleanupResponse(BaseModel):
    message: str
    status: str
    mode: str
    scanned_count: Optional[int] = None
    cleaned_count: Optional[int] = None
    remaining_count: Optional[int] = None
    cleaned_events: Optional[List[Dict[str, Any]]] = None


async def _execute_and_notify(
    job_id: str,
    trigger_source: str,
    triggered_at: str,
    notify_n8n: bool = True,
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute pipeline gateway, notify n8n webhook, and fall back to direct Telegram delivery."""
    job_store.mark_running(job_id)
    try:
        summary = await run_pipeline_gateway()
        notified = False
        if notify_n8n:
            notified = await n8n_client.notify_pipeline_result(
                job_id=job_id,
                status="success",
                triggered_at=triggered_at,
                trigger_source=trigger_source,
                summary=summary,
                callback_url=callback_url,
            )
        telegram_sent = False
        if not notified:
            n8n_err = getattr(n8n_client, "last_error", None)
            tg_summary = dict(summary)
            if notify_n8n and n8n_err:
                existing_logs = list(tg_summary.get("error_logs") or [])
                existing_logs.append(f"n8n callback failed ({n8n_err})")
                tg_summary["error_logs"] = existing_logs
            telegram_sent = await telegram_notifier.notify_pipeline_result(
                job_id=job_id,
                status="success",
                trigger_source=trigger_source,
                summary=tg_summary,
            )
        job_store.mark_completed(
            job_id=job_id,
            status="success",
            summary=summary,
            n8n_notified=notified if notify_n8n else None,
            telegram_notified=telegram_sent if not notified else None,
        )
        logger.info(f"Pipeline job [{job_id}] finished (n8n_notified={notified}, telegram_notified={telegram_sent}).")
        return summary
    except Exception as exc:
        err_msg = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
        logger.error(f"Pipeline job [{job_id}] failed: {err_msg}")
        notified = False
        if notify_n8n:
            notified = await n8n_client.notify_pipeline_result(
                job_id=job_id,
                status="failed",
                triggered_at=triggered_at,
                trigger_source=trigger_source,
                error=err_msg,
                callback_url=callback_url,
            )
        telegram_sent = False
        if not notified:
            n8n_err = getattr(n8n_client, "last_error", None)
            tg_summary = {"error_logs": [f"n8n callback failed ({n8n_err})"]} if (notify_n8n and n8n_err) else None
            telegram_sent = await telegram_notifier.notify_pipeline_result(
                job_id=job_id,
                status="failed",
                trigger_source=trigger_source,
                summary=tg_summary,
                error=err_msg,
            )
        job_store.mark_completed(
            job_id=job_id,
            status="failed",
            error=err_msg,
            n8n_notified=notified if notify_n8n else None,
            telegram_notified=telegram_sent if not notified else None,
        )
        raise


async def background_pipeline_runner(
    job_id: str,
    trigger_source: str,
    triggered_at: str,
    notify_n8n: bool = True,
    callback_url: Optional[str] = None,
):
    """Background execution wrapper for pipeline gateway."""
    try:
        await _execute_and_notify(
            job_id=job_id,
            trigger_source=trigger_source,
            triggered_at=triggered_at,
            notify_n8n=notify_n8n,
            callback_url=callback_url,
        )
    except Exception:
        # Failure is already logged, recorded in job_store, and sent to n8n
        pass


async def background_cleanup_runner(max_age_days: int = 7):
    """Background execution wrapper for Redis passed event cleanup."""
    try:
        redis_storage = RedisEventStorage()
        summary = await redis_storage.cleanup_passed_events(max_age_days=max_age_days)
        await redis_storage.close()
        logger.info(f"Background Redis Passed Event Cleanup Summary: {summary}")
    except Exception as e:
        logger.error(f"Background Redis Event Cleanup Error: {e}")


@router.post(
    "/trigger",
    response_model=TriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger Scraper Pipeline (n8n / Cron Gateway Endpoint)",
    description="Protected by X-Api-Key. Triggers scraping & extraction and notifies n8n webhook with the JSON result.",
    dependencies=[Depends(require_api_key)],
)
async def trigger_scraper_pipeline(
    background_tasks: BackgroundTasks,
    async_mode: bool = Query(True, description="If True, runs pipeline asynchronously in background"),
    payload: Optional[TriggerRequest] = Body(default=None),
):
    """Gateway endpoint called by n8n or Cron jobs to start pipeline execution."""
    req = payload or TriggerRequest()
    job_id = (req.job_id or "").strip() or f"job_{uuid.uuid4().hex[:12]}"
    record = job_store.create(job_id=job_id, trigger_source=req.trigger_source)
    callback_configured = bool(req.notify_n8n and (req.callback_url or n8n_client.webhook_url) and n8n_client.api_key)

    logger.info(
        f"Pipeline trigger accepted (job_id={job_id}, source={req.trigger_source}, async={async_mode}, callback={callback_configured})."
    )

    if async_mode:
        background_tasks.add_task(
            background_pipeline_runner,
            job_id=job_id,
            trigger_source=req.trigger_source,
            triggered_at=record.triggered_at,
            notify_n8n=req.notify_n8n,
            callback_url=req.callback_url,
        )
        return TriggerResponse(
            message="Scraper pipeline execution queued in background.",
            status="queued",
            mode="async",
            job_id=job_id,
            callback_configured=callback_configured,
        )

    # Synchronous execution mode
    try:
        summary = await _execute_and_notify(
            job_id=job_id,
            trigger_source=req.trigger_source,
            triggered_at=record.triggered_at,
            notify_n8n=req.notify_n8n,
            callback_url=req.callback_url,
        )
        return TriggerResponse(
            message=f"Scraper pipeline execution completed in {summary.get('duration_seconds')}s. Scraped {summary.get('total_posts_scraped')} posts, extracted {summary.get('events_extracted')} events.",
            status="success",
            mode="sync",
            job_id=job_id,
            callback_configured=callback_configured,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution failed: {str(e)}",
        )


@router.get(
    "/jobs/{job_id}",
    response_model=PipelineJobRecord,
    summary="Get Pipeline Job Execution Status",
    description="Allows n8n or automation runners to inspect the status and result of a triggered pipeline job. Requires X-Api-Key header.",
    dependencies=[Depends(require_api_key)],
)
async def get_pipeline_job_status(job_id: str):
    """Fetch execution state and summary for a pipeline job ID."""
    record = job_store.get(job_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    return record


@router.post(
    "/cleanup",
    response_model=CleanupResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger Passed Events Cleanup (Cron Gateway Endpoint)",
    description="Endpoint for Cron jobs or webhooks to remove passed events from Redis cache. Requires X-Api-Key header.",
    dependencies=[Depends(require_api_key)],
)
async def trigger_passed_events_cleanup(
    background_tasks: BackgroundTasks,
    async_mode: bool = Query(False, description="If True, runs cleanup asynchronously in background"),
    max_age_days: int = Query(7, description="Delete passed events older than this many days (0 deletes all passed events)"),
):
    """Gateway endpoint called by Cron jobs or webhooks to clean up concluded events from Redis."""
    logger.info(f"Passed events cleanup trigger received via API endpoint (max_age_days={max_age_days}).")

    if async_mode:
        background_tasks.add_task(background_cleanup_runner, max_age_days=max_age_days)
        return CleanupResponse(
            message="Redis passed events cleanup triggered in background successfully.",
            status="queued",
            mode="async"
        )

    try:
        redis_storage = RedisEventStorage()
        summary = await redis_storage.cleanup_passed_events(max_age_days=max_age_days)
        await redis_storage.close()
        return CleanupResponse(
            message=f"Cleaned up {summary.get('cleaned_count', 0)} passed events (older than {max_age_days}d). {summary.get('remaining_count', 0)} active events remain.",
            status="success",
            mode="sync",
            scanned_count=summary.get("scanned_count"),
            cleaned_count=summary.get("cleaned_count"),
            remaining_count=summary.get("remaining_count"),
            cleaned_events=summary.get("cleaned_events")
        )
    except Exception as e:
        logger.error(f"Synchronous event cleanup execution error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Event cleanup failed: {str(e)}"
        )
