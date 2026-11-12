"""Core configuration module."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Paza Event Bot Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # PostgreSQL Database Settings
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/addis_event_db"

    @property
    def sqlalchemy_database_uri(self) -> str:
        return self.DATABASE_URL

    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM API Keys
    GEMINI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Legacy Organizer JWT Fallback (unused when using Clerk)
    JWT_SECRET_KEY: str = ""
    JWT_ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    # Clerk Authentication Settings
    VITE_CLERK_PUBLISHABLE_KEY: str = ""
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""

    # n8n Two-Way Integration Settings
    PIPELINE_API_KEY: str = ""
    N8N_WEBHOOK_URL: str = ""
    N8N_API_KEY: str = ""
    N8N_API_KEY_HEADER: str = "X-Api-Key"
    N8N_WEBHOOK_TIMEOUT_SECONDS: float = 15.0

    # Telegram Bot Notification Settings (restricted to single chat ID)
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # Web App Settings
    WEB_APP_URL: str = "http://localhost:5173"

    # Scraper Session Credentials
    INSTAGRAM_USERNAME: str = ""
    INSTAGRAM_SESSION_ID: str = ""
    TIKTOK_SESSION_ID: str = ""

    # AWS S3 Storage Settings (uses ~/.aws/credentials locally or EC2 IAM role in prod)
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "paza-events-media"
    S3_PUBLIC_URL: str = ""
    UPLOAD_DIR: str = "static/uploads"

    @field_validator("PORT", "JWT_ACCESS_TOKEN_EXPIRE_DAYS", mode="before")
    @classmethod
    def parse_empty_int(cls, v, info):
        if v == "" or v is None:
            return {"PORT": 8000, "JWT_ACCESS_TOKEN_EXPIRE_DAYS": 30}.get(info.field_name, 30)
        return int(v)

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_empty_bool(cls, v):
        if v == "" or v is None:
            return True
        if isinstance(v, bool):
            return v
        return str(v).strip().lower() in ("1", "true", "yes", "on")

    @field_validator("N8N_WEBHOOK_TIMEOUT_SECONDS", mode="before")
    @classmethod
    def parse_empty_float(cls, v):
        if v == "" or v is None:
            return 15.0
        return float(v)

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
