import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: Literal["admin", "marketing"]
    created_at: datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class MarketingUpdate(BaseModel):
    """Admin-side edit of a marketing account. Any field may be omitted."""

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
