"""PostgreSQL Target Repository for managing active scraper targets, prioritization, and watermarks."""

import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional
from sqlalchemy import case, func, select, update
from app.db.session import AsyncSessionLocal
from app.db.models import ScraperTargetDB, ScraperPlatformEnum, ScraperTargetType
from app.schemas.event import ScraperTarget, ScraperPlatform, TargetType

logger = logging.getLogger(__name__)


class DatabaseTargetRepository:
    """Modular target repository: prioritized fetching, chunked generation, and watermark syncing."""

    @staticmethod
    def _to_schema(db_target: ScraperTargetDB) -> ScraperTarget:
        """Map ORM entity to Pydantic ScraperTarget schema."""
        return ScraperTarget(
            platform=ScraperPlatform(db_target.platform.value if hasattr(db_target.platform, "value") else str(db_target.platform)),
            target_type=TargetType(db_target.target_type.value if hasattr(db_target.target_type, "value") else str(db_target.target_type)),
            value=db_target.value,
            max_posts=db_target.max_posts_per_cycle,
            last_watermark=str(db_target.last_watermark or "0"),
            is_active=db_target.is_active,
        )

    async def get_active_target_count(self) -> int:
        """Count total number of active targets."""
        async with AsyncSessionLocal() as session:
            stmt = select(func.count()).select_from(ScraperTargetDB).where(ScraperTargetDB.is_active == True)
            res = await session.execute(stmt)
            return res.scalar() or 0

    async def get_active_targets(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
        prioritize_unscraped: bool = True,
    ) -> List[ScraperTarget]:
        """Fetch active targets from PostgreSQL with watermark prioritization.

        Targets with last_watermark == "0", empty, or null are given top priority (priority=0),
        followed by previously scraped targets ordered by updated_at ASC (least recently scraped first).
        """
        try:
            async with AsyncSessionLocal() as session:
                stmt = select(ScraperTargetDB).where(ScraperTargetDB.is_active == True)

                if prioritize_unscraped:
                    # Watermark 0 / empty / null = fresh unscraped channel -> top priority
                    watermark_priority = case(
                        (ScraperTargetDB.last_watermark.in_(["0", ""]), 0),
                        (ScraperTargetDB.last_watermark.is_(None), 0),
                        else_=1,
                    )
                    stmt = stmt.order_by(
                        watermark_priority.asc(),
                        ScraperTargetDB.updated_at.asc(),
                        ScraperTargetDB.created_at.asc(),
                    )
                else:
                    stmt = stmt.order_by(ScraperTargetDB.created_at.asc())

                if offset > 0:
                    stmt = stmt.offset(offset)
                if limit is not None:
                    stmt = stmt.limit(limit)

                res = await session.execute(stmt)
                db_targets = res.scalars().all()
                targets = [self._to_schema(t) for t in db_targets]

                logger.info(
                    f"Fetched {len(targets)} active targets from PostgreSQL "
                    f"(limit={limit}, offset={offset}, prioritize_unscraped={prioritize_unscraped})."
                )
                return targets
        except Exception as e:
            logger.error(f"Failed to fetch active targets from PostgreSQL: {e}")
            raise RuntimeError(f"Failed to fetch active targets from PostgreSQL: {e}") from e

    async def get_active_targets_chunked(
        self,
        chunk_size: int = 5,
        prioritize_unscraped: bool = True,
    ) -> AsyncGenerator[List[ScraperTarget], None]:
        """Asynchronously yield active scraper targets in prioritized chunks of size `chunk_size`.

        Allows bounded memory consumption and progressive scraping cycles.
        """
        offset = 0
        while True:
            chunk = await self.get_active_targets(
                limit=chunk_size,
                offset=offset,
                prioritize_unscraped=prioritize_unscraped,
            )
            if not chunk:
                break
            yield chunk
            if len(chunk) < chunk_size:
                break
            offset += len(chunk)

    async def update_watermark(self, platform: str, value: str, new_watermark: str) -> bool:
        """Update last_watermark and updated_at for a target in PostgreSQL DB."""
        async with AsyncSessionLocal() as session:
            try:
                plat_enum = ScraperPlatformEnum(platform.lower())
                stmt = (
                    update(ScraperTargetDB)
                    .where(
                        ScraperTargetDB.platform == plat_enum,
                        ScraperTargetDB.value == value,
                    )
                    .values(
                        last_watermark=str(new_watermark),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.execute(stmt)
                await session.commit()
                logger.info(f"PostgreSQL: Updated watermark for [{platform}] @{value} -> {new_watermark}")
                return True
            except Exception as e:
                logger.error(f"Failed to update PostgreSQL watermark for [{platform}] @{value}: {e}")
                await session.rollback()
                raise RuntimeError(f"Failed to update PostgreSQL watermark for [{platform}] @{value}: {e}") from e

    async def sync_all_watermarks(self, updated_targets: List[ScraperTarget]) -> None:
        """Batch update watermarks for a list or chunk of targets within a single transaction."""
        if not updated_targets:
            return

        async with AsyncSessionLocal() as session:
            try:
                now = datetime.now(timezone.utc)
                for target in updated_targets:
                    if not target.last_watermark:
                        continue
                    plat_enum = ScraperPlatformEnum(target.platform.value.lower())
                    stmt = (
                        update(ScraperTargetDB)
                        .where(
                            ScraperTargetDB.platform == plat_enum,
                            ScraperTargetDB.value == target.value,
                        )
                        .values(
                            last_watermark=str(target.last_watermark),
                            updated_at=now,
                        )
                    )
                    await session.execute(stmt)
                await session.commit()
                logger.info(f"PostgreSQL: Batch synced watermarks for {len(updated_targets)} targets.")
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to batch sync watermarks to PostgreSQL: {e}")
                raise RuntimeError(f"Failed to batch sync watermarks to PostgreSQL: {e}") from e
