"""User and Interest Pydantic Schemas for Request/Response validation and OpenAPI Docs."""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class InterestSchema(BaseModel):
    id: UUID = Field(..., description="Unique interest UUID")
    slug: str = Field(..., description="Normalized interest slug (e.g. music, nightlife)")
    name_en: str = Field(..., description="English interest name")
    name_am: Optional[str] = Field(None, description="Amharic interest name")
    icon_name: Optional[str] = Field(None, description="Emoji or icon identifier")

    class Config:
        from_attributes = True


class UserProfileSchema(BaseModel):
    id: UUID = Field(..., description="Unique User UUID")
    clerk_id: Optional[str] = Field(None, description="Clerk user ID")
    telegram_id: Optional[int] = Field(None, description="User numeric ID")
    email: Optional[str] = Field(None, description="User email address")
    full_name: Optional[str] = Field(None, description="User full name")
    username: Optional[str] = Field(None, description="User username")
    phone_number: Optional[str] = Field(None, description="Phone number")
    preferred_language: str = Field("en", description="Preferred UI language")
    role: str = Field("USER", description="User role (USER, ORGANIZER, ADMIN)")
    is_registered: bool = Field(True, description="True if profile is active")
    interests: List[InterestSchema] = Field(default=[], description="User's selected interests")

    class Config:
        from_attributes = True


class InterestSelectionRequest(BaseModel):
    telegram_id: Optional[int] = Field(None, description="User numeric ID")
    user_id: Optional[str] = Field(None, description="User ID string or UUID")
    interest_slugs: List[str] = Field(..., description="List of selected interest slugs (e.g. ['music', 'food'])")
