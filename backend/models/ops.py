import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class MarketingTarget(BaseModel):
    """Monthly deal target for one marketing user, with progress for that month."""

    marketing_id: str
    marketing_name: str
    month: str  # YYYY-MM
    target_deals: int
    achieved: int
    progress: float


class TargetUpsert(BaseModel):
    marketing_id: str
    month: str
    target_deals: int


class Transfer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    lead_nama: str
    from_id: Optional[str] = None
    from_name: str
    to_id: str
    to_name: str
    by_id: str
    by_name: str
    mode: str  # single | bulk | auto
    created_at: datetime = Field(default_factory=now_utc)


class AutoDistributeRequest(BaseModel):
    marketing_ids: List[str]
    type: Optional[str] = None


class AutoDistributeResult(BaseModel):
    distributed: int
    per_marketing: dict


class Catatan(BaseModel):
    """A marketing user's own working note. Admin can read but not edit these."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    title: str
    body: str
    lead_id: Optional[str] = None
    lead_nama: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class CatatanCreate(BaseModel):
    title: str
    body: str
    lead_id: Optional[str] = None


class CatatanUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    lead_id: Optional[str] = None


class Jadwal(BaseModel):
    """A prospecting appointment owned by one marketing user."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_nama: str
    marketing_id: str
    marketing_name: str
    lokasi: str
    tanggal: str  # YYYY-MM-DD
    jam: str  # HH:MM
    kendaraan: str
    status: str = "Terjadwal"  # Terjadwal | Selesai | Dibatalkan
    hasil_pertemuan: Optional[str] = None
    lead_id: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class JadwalCreate(BaseModel):
    client_nama: str
    lokasi: str
    tanggal: str
    jam: str
    kendaraan: str
    lead_id: Optional[str] = None
    marketing_id: Optional[str] = None  # admin may schedule on behalf of a marketing user


class JadwalUpdate(BaseModel):
    client_nama: Optional[str] = None
    lokasi: Optional[str] = None
    tanggal: Optional[str] = None
    jam: Optional[str] = None
    kendaraan: Optional[str] = None
    status: Optional[str] = None
    hasil_pertemuan: Optional[str] = None


class JadwalReminder(BaseModel):
    """A still-open appointment whose date has arrived (or passed)."""

    id: str
    client_nama: str
    marketing_name: str
    lokasi: str
    tanggal: str
    jam: str
    kendaraan: str
    overdue: bool


class RekapProspek(BaseModel):
    """Per-marketing appointment recap for one month."""

    marketing_id: str
    marketing_name: str
    month: str
    total: int
    terjadwal: int
    selesai: int
    dibatalkan: int
    ada_hasil: int
