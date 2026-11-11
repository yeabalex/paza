"""Pipeline Gateway Module — Central execution gateway for triggering multi-platform scraping & event extraction pipeline.

Can be called directly as a Python library function, executed via CLI, or triggered asynchronously via FastAPI endpoint / Cron job.
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

from app.core.pipeline_logger import PipelineLogger
from app.schemas.event import ScraperTarget
from app.services.scraper.db_target_repository import DatabaseTargetRepository
from app.services.cache.redis_event_storage import RedisEventStorage
from app.services.scraper.redis_queue import RedisQueueManager
from app.services.scraper.producer import ScraperProducer
from app.services.transcriber.whisper import WhisperTranscriber
from app.services.classifier.event_classifier import EventClassifier
from app.services.llm.router import LLMRouter


async def run_pipeline_gateway(
    config_file: str = "targets_config.json",
    output_file: str = "scraped_events_output.json"
) -> Dict[str, Any]:
    """Central Gateway Function to trigger full multi-platform scraping pipeline.
    
    1. Fetch active targets from PostgreSQL DB (with fallback to config file)
    2. Execute unified scraping cycle across Telegram, Instagram, TikTok
    3. Update watermarks back to DB & config file
    4. Run video audio transcriptions (Whisper) & local Event Classification
    5. Pass event candidates to LLM Router for structured event extraction
    6. Save events to Redis/Valkey cache & produce JSON execution summary
    """
    start_time = PipelineLogger.log_pipeline_start(config_file, output_file)

    db_repo = DatabaseTargetRepository()
    redis_storage = RedisEventStorage()

    # Stage 1: Fetch active targets from PostgreSQL DB
    PipelineLogger.log_stage(1, "PostgreSQL Active Targets Fetch")
    try:
        targets = await db_repo.get_active_targets()
    except Exception as db_err:
        PipelineLogger.log_pipeline_failure("Stage 1: PostgreSQL Active Targets Fetch", db_err, time.time() - start_time)
        raise RuntimeError(f"Pipeline Gateway failed fetching active targets from PostgreSQL: {db_err}") from db_err

    if not targets:
        path = Path(config_file)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
            targets = [
                ScraperTarget(
                    platform=item["platform"],
                    target_type=item.get("target_type", "username"),
                    value=item["value"].strip(),
                    max_posts=item.get("max_posts", 5),
                    last_watermark=str(item.get("last_watermark", "0")),
                    is_active=item.get("is_active", True)
                )
                for item in raw_list
            ]
            PipelineLogger.log_stage(1, "PostgreSQL Active Targets Fetch", f"Loaded {len(targets)} fallback targets from '{config_file}'")
        else:
            err = RuntimeError(f"No active targets found in PostgreSQL DB or '{config_file}'")
            PipelineLogger.log_pipeline_failure("Stage 1: Target Load", err, time.time() - start_time)
            raise err

    # Stage 2: Run scraping producer cycle
    PipelineLogger.log_stage(2, "Multi-Platform Scraping Producer Cycle", f"{len(targets)} active targets")
    queue_manager = RedisQueueManager()
    producer = ScraperProducer(queue_manager=queue_manager)

    try:
        updated_targets = await producer.run_unified_producer_cycle(targets)
    except Exception as scrap_err:
        PipelineLogger.log_pipeline_failure("Stage 2: Multi-Platform Scraping Producer Cycle", scrap_err, time.time() - start_time)
        raise RuntimeError(f"Pipeline Gateway scraping producer cycle failed: {scrap_err}") from scrap_err

    error_logs: List[str] = list(getattr(producer, "last_errors", []) or [])

    # Stage 3: Sync watermarks back to DB
    PipelineLogger.log_stage(3, "PostgreSQL Watermark Synchronization")
    try:
        await db_repo.sync_all_watermarks(updated_targets)
    except Exception as db_sync_err:
        PipelineLogger.log_pipeline_failure("Stage 3: PostgreSQL Watermark Synchronization", db_sync_err, time.time() - start_time)
        raise RuntimeError(f"Pipeline Gateway failed syncing watermarks to PostgreSQL: {db_sync_err}") from db_sync_err

    # Stage 4 & 5: Processing staged raw posts & LLM extraction
    staged_task_ids = list(queue_manager._in_memory_staging.keys())
    PipelineLogger.log_stage(4, "Post Processing & LLM Extraction", f"Processing {len(staged_task_ids)} staged posts")

    classifier = EventClassifier.get_instance()
    classifier._lazy_init_model()
    llm_router = LLMRouter()
    if staged_task_ids:
        await redis_storage.get_client()

    concurrency_sem = asyncio.Semaphore(4)

    async def _process_staged_task(task_id: str) -> Dict[str, Any]:
        async with concurrency_sem:
            staged = await queue_manager.get_staged_message(task_id)
            if not staged:
                return {}

            post_errors: List[str] = []
            post_titles: List[str] = []
            local_events_extracted = 0
            local_passed_skipped = 0
            local_non_events = 0
            local_failed_transcriptions = 0
            local_failed_extractions = 0
            local_llm_attempted = 0
            local_llm_succeeded = 0

            raw_caption = staged.get("raw_text") or ""
            post_url = staged.get("post_url") or ""
            platform = staged.get("platform")
            source_handle = staged.get("channel_username") or "unknown"

            # Transcribe audio for video posts if needed
            if platform in ("tiktok", "instagram") and post_url:
                transcriber = WhisperTranscriber()
                try:
                    raw_caption = await transcriber.transcribe_post_video_if_needed(
                        post_url=post_url,
                        current_caption=raw_caption,
                        min_caption_len=800
                    )
                    if transcriber.last_error:
                        local_failed_transcriptions += 1
                        post_errors.append(f"Transcribe @{source_handle}: {transcriber.last_error}")
                except Exception as t_err:
                    local_failed_transcriptions += 1
                    err_detail = f"{type(t_err).__name__}: {t_err}" if str(t_err) else type(t_err).__name__
                    post_errors.append(f"Transcribe @{source_handle}: {err_detail}")

            # Local Classifier
            is_event, confidence, _meta = classifier.classify(raw_caption)
            extracted_event_data = None
            extracted_by_provider = None

            if is_event:
                local_llm_attempted += 1
                llm_context = f"[Platform: {platform} | Source: @{source_handle}]\n\n{raw_caption}"
                events_res_list = []
                provider_name = None
                try:
                    events_res_list, provider_name = await llm_router.extract_events_alternating(
                        llm_context,
                        allow_heuristic_fallback=False,
                    )
                    local_llm_succeeded += 1
                    extracted_by_provider = provider_name
                except Exception as llm_err:
                    local_failed_extractions += 1
                    err_detail = f"{type(llm_err).__name__}: {llm_err}" if str(llm_err) else type(llm_err).__name__
                    post_errors.append(f"LLM @{source_handle}: {err_detail}")

                if events_res_list:
                    base_post_id = str(staged.get("message_id") or task_id)
                    saved_any_event = False
                    for sub_idx, event_res in enumerate(events_res_list, start=1):
                        if not event_res or not event_res.is_event:
                            continue

                        # Check if event date has already passed
                        if redis_storage.is_event_passed(event_res.start_datetime, event_res.end_datetime):
                            logger.info(
                                f"Skipping passed event candidate: '{event_res.title}' "
                                f"({event_res.start_datetime} to {event_res.end_datetime}) - not adding to Redis."
                            )
                            local_passed_skipped += 1
                            continue

                        local_events_extracted += 1
                        saved_any_event = True
                        if event_res.title:
                            post_titles.append(event_res.title)
                        extracted_event_data = {
                            "title": event_res.title,
                            "description": event_res.description,
                            "short_summary": event_res.short_summary,
                            "start_datetime": event_res.start_datetime,
                            "end_datetime": event_res.end_datetime,
                            "venue_name": event_res.venue_name,
                            "location_gps": event_res.location_gps,
                            "sub_city": event_res.sub_city,
                            "entrance_fee_etb": event_res.entrance_fee_etb,
                            "category": event_res.category,
                            "confidence_score": event_res.confidence_score,
                        }
                        post_key = base_post_id if len(events_res_list) == 1 else f"{base_post_id}_{sub_idx}"
                        try:
                            await redis_storage.save_event(
                                platform=platform,
                                post_id=post_key,
                                event_dict=extracted_event_data,
                                raw_metadata={
                                    "task_id": task_id,
                                    "handle_or_channel": source_handle,
                                    "post_url": post_url,
                                    "extracted_by": provider_name,
                                    "classifier_score": confidence
                                }
                            )
                        except Exception as redis_save_err:
                            PipelineLogger.log_pipeline_failure("Stage 6: Redis Cache Storage", redis_save_err, time.time() - start_time)
                            raise redis_save_err
                    if not saved_any_event:
                        local_non_events += 1
                elif local_llm_succeeded > 0:
                    local_non_events += 1
            else:
                local_non_events += 1

            return {
                "post": {
                    "task_id": task_id,
                    "platform": platform,
                    "handle_or_channel": source_handle,
                    "post_id": staged.get("message_id"),
                    "post_url": post_url,
                    "scraped_date": staged.get("scraped_date"),
                    "is_event_candidate": is_event,
                    "classifier_score": confidence,
                    "extracted_by": extracted_by_provider,
                    "extracted_event": extracted_event_data,
                    "raw_caption": raw_caption
                },
                "titles": post_titles,
                "errors": post_errors,
                "events_extracted": local_events_extracted,
                "passed_skipped": local_passed_skipped,
                "non_events": local_non_events,
                "failed_transcriptions": local_failed_transcriptions,
                "failed_extractions": local_failed_extractions,
                "llm_attempted": local_llm_attempted,
                "llm_succeeded": local_llm_succeeded,
            }

    post_results = await asyncio.gather(*(_process_staged_task(tid) for tid in staged_task_ids))

    scraped_posts: List[Dict[str, Any]] = []
    extracted_titles: List[str] = []
    events_extracted_count = 0
    passed_events_skipped_count = 0
    non_events_count = 0
    failed_transcriptions_count = 0
    failed_extractions_count = 0
    llm_attempted_count = 0
    llm_succeeded_count = 0

    for res in post_results:
        if not res:
            continue
        scraped_posts.append(res["post"])
        extracted_titles.extend(res["titles"])
        error_logs.extend(res["errors"])
        events_extracted_count += res["events_extracted"]
        passed_events_skipped_count += res["passed_skipped"]
        non_events_count += res["non_events"]
        failed_transcriptions_count += res["failed_transcriptions"]
        failed_extractions_count += res["failed_extractions"]
        llm_attempted_count += res["llm_attempted"]
        llm_succeeded_count += res["llm_succeeded"]

    # Redis cache hygiene: Clean up any passed events from Redis store
    cleaned_events_count = 0
    try:
        cleanup_res = await redis_storage.cleanup_passed_events()
        cleaned_events_count = cleanup_res.get("cleaned_count", 0)
        logger.info(f"Pipeline Redis hygiene cleanup: {cleaned_events_count} passed events removed.")
    except Exception as clean_err:
        err_detail = f"{type(clean_err).__name__}: {clean_err}" if str(clean_err) else type(clean_err).__name__
        logger.warning(f"Pipeline Redis hygiene cleanup warning: {err_detail}")
        error_logs.append(f"Redis cleanup: {err_detail}")

    await redis_storage.close()

    deduped_error_logs = list(dict.fromkeys(error_logs))[:15]
    if llm_attempted_count > 0 and llm_succeeded_count == 0 and failed_extractions_count == llm_attempted_count:
        fail_err = RuntimeError(
            f"All {failed_extractions_count} LLM extractions failed: "
            + ("; ".join(deduped_error_logs[:3]) or "Unknown LLM error")
        )
        PipelineLogger.log_pipeline_failure("Stage 4: LLM Extraction", fail_err, time.time() - start_time)
        raise fail_err

    # Stage 6: Write audit output file
    PipelineLogger.log_stage(6, "Audit Report Export", f"Writing JSON output to '{output_file}'")
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(scraped_posts, f, indent=2, ensure_ascii=False)
    except Exception as file_err:
        PipelineLogger.log_pipeline_failure("Stage 6: Audit Report Export", file_err, time.time() - start_time)
        raise file_err

    duration = round(time.time() - start_time, 2)
    summary = PipelineLogger.log_pipeline_success(
        duration_seconds=duration,
        targets_processed=len(targets),
        total_posts_scraped=len(scraped_posts),
        events_extracted=events_extracted_count,
        non_events_count=non_events_count,
        failed_transcriptions=failed_transcriptions_count,
        failed_extractions=failed_extractions_count,
        output_file=output_file
    )
    summary["passed_events_skipped"] = passed_events_skipped_count
    summary["passed_events_cleaned"] = cleaned_events_count
    summary["extracted_titles"] = extracted_titles
    summary["error_logs"] = deduped_error_logs

    # Purge temporary export file
    import os
    if os.path.exists(output_file):
        try:
            os.remove(output_file)
        except Exception:
            pass

    return summary


if __name__ == "__main__":
    asyncio.run(run_pipeline_gateway())
