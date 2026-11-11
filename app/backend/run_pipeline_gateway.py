#!/usr/bin/env python3
"""Standalone Cron Executable Script to run the Multi-Platform Scraping Pipeline."""

import asyncio
import logging
import sys
import uuid

from app.services.integrations import telegram_notifier
from app.services.pipeline_gateway import run_pipeline_gateway

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)


async def _run() -> None:
    job_id = f"cli_{uuid.uuid4().hex[:10]}"
    try:
        summary = await run_pipeline_gateway()
        print("\n--- Pipeline Gateway Result ---")
        print(summary)
        await telegram_notifier.notify_pipeline_result(
            job_id=job_id,
            status="success",
            trigger_source="cli",
            summary=summary,
        )
    except Exception as exc:
        await telegram_notifier.notify_pipeline_result(
            job_id=job_id,
            status="failed",
            trigger_source="cli",
            error=str(exc),
        )
        raise


def main():
    asyncio.run(_run())


if __name__ == "__main__":
    main()
