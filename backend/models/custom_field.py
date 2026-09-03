import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def slugify(label: str) -> str:
    """Stable storage key for a custom column: 'Kode Referensi' -> 'kode_referensi'."""
    slug = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")
    return slug or f"kolom_{uuid.uuid4().hex[:6]}"


class CustomField(BaseModel):
    """An admin-defined extra column stored on every lead under `lead.custom[key]`.

    `key` is written once and never changes, so renaming the label keeps existing values.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str
    label: str
    created_at: datetime = Field(default_factory=now_utc)


class CustomFieldCreate(BaseModel):
    label: str


class CustomFieldUpdate(BaseModel):
    label: str


class DeleteAllResult(BaseModel):
    deleted: int
    nasabah: int
    pelamar: int


class CustomColumnChoice(BaseModel):
    """One spreadsheet column the admin decided to keep as a custom field during import."""

    column: str
    label: Optional[str] = None
