import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class ProgressNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    status: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=now_utc)


class NoteCreate(BaseModel):
    text: str
    status: Optional[str] = None


class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["nasabah", "pelamar"]
    nama: str
    no_hp: str
    email: Optional[str] = None
    alamat: Optional[str] = None
    produk: Optional[str] = None
    posisi: Optional[str] = None
    nik: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    sumber: str
    status: str
    catatan: Optional[str] = None
    tanggal_follow_up: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    notes: List[ProgressNote] = []


class LeadCreate(BaseModel):
    type: Literal["nasabah", "pelamar"]
    nama: str
    no_hp: str
    email: Optional[str] = None
    alamat: Optional[str] = None
    produk: Optional[str] = None
    posisi: Optional[str] = None
    nik: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    sumber: str
    status: str = "Baru"
    catatan: Optional[str] = None
    tanggal_follow_up: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadUpdate(BaseModel):
    nama: Optional[str] = None
    no_hp: Optional[str] = None
    email: Optional[str] = None
    alamat: Optional[str] = None
    produk: Optional[str] = None
    posisi: Optional[str] = None
    nik: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    sumber: Optional[str] = None
    status: Optional[str] = None
    catatan: Optional[str] = None
    tanggal_follow_up: Optional[str] = None


class AssignRequest(BaseModel):
    assigned_to: str


class LeadStats(BaseModel):
    total: int
    by_status: dict
    by_type: dict
    by_marketing: dict
    follow_up_today: int
