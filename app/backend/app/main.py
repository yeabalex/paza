"""Main FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import AuthEnforcementMiddleware


from app.db.session import engine
from app.db.models import Base
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks: verify schema with a single fast query; create/migrate only when missing
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            col_count = await conn.scalar(text("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND (
                    (table_name = 'users' AND column_name IN ('clerk_id', 'email', 'hashed_password', 'google_id'))
                    OR (table_name = 'organizers' AND column_name IN ('support_phone', 'social_links', 'username'))
                    OR (table_name = 'events' AND column_name = 'short_description')
                    OR (table_name = 'event_rsvps' AND column_name IN ('full_name', 'transaction_id', 'screenshot_url', 'payment_method', 'ticket_code', 'status'))
                    OR (table_name = 'interests' AND column_name = 'slug')
                    OR (table_name = 'scraper_targets' AND column_name = 'last_watermark')
                    OR (table_name = 'saved_scraped_events' AND column_name = 'event_data')
                  )
            """))
            if (col_count or 0) < 17:
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255);"))
                await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_clerk_id ON users (clerk_id);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS support_phone VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS social_links JSONB;"))
                await conn.execute(text("ALTER TABLE organizers ADD COLUMN IF NOT EXISTS username VARCHAR(100);"))
                await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_organizers_username ON organizers (username);"))
                await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS screenshot_url TEXT;"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(100);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_event_rsvps_ticket_code ON event_rsvps (ticket_code);"))
                await conn.execute(text("ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';"))
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
    yield
    # Shutdown tasks


is_prod = settings.ENVIRONMENT.lower() == "production" and not settings.DEBUG

app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Global fail-closed Auth Middleware (added before CORS so CORS wraps 401/403 responses)
app.add_middleware(AuthEnforcementMiddleware)

_cors_origins = [
    "https://paza.yab.et",
    "https://www.paza.yab.et",
]
if settings.WEB_APP_URL and settings.WEB_APP_URL not in _cors_origins:
    _cors_origins.append(settings.WEB_APP_URL)

if not is_prod:
    _cors_origins.extend([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ])

# CORS middleware configuration (outermost wrapper)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=None if is_prod else r"http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Static files mount for local upload fallback
import os
from fastapi.staticfiles import StaticFiles
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", tags=["Root"])
async def root():
    res = {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "health": f"{settings.API_V1_STR}/health"
    }
    if not is_prod:
        res["docs"] = "/docs"
    return res
