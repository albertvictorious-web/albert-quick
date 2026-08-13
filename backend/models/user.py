import uuid
from datetime import datetime, timezone
from typing import Literal

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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
