import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

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
    # Shared fields
    nama: str
    no_wa: str
    usia: Optional[int] = None
    kota: Optional[str] = None
    # Nasabah-only fields
    profesi: Optional[str] = None
    pernah_trading: Optional[str] = None  # "Ya" | "Belum"
    sumber: Optional[str] = None
    # Pelamar-only fields
    pendidikan: Optional[str] = None  # SMP | SMA | Diploma | Sarjana
    cv_file_id: Optional[str] = None
    cv_filename: Optional[str] = None
    # Workflow
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
    # Admin-defined extra columns, keyed by CustomField.key.
    custom: Dict[str, str] = {}


class LeadCreate(BaseModel):
    type: Literal["nasabah", "pelamar"]
    nama: str
    no_wa: str
    usia: Optional[int] = None
    kota: Optional[str] = None
    profesi: Optional[str] = None
    pernah_trading: Optional[str] = None
    sumber: Optional[str] = None
    pendidikan: Optional[str] = None
    cv_file_id: Optional[str] = None
    cv_filename: Optional[str] = None
    status: str = "Baru"
    catatan: Optional[str] = None
    tanggal_follow_up: Optional[str] = None
    assigned_to: Optional[str] = None
    custom: Dict[str, str] = {}


class LeadUpdate(BaseModel):
    nama: Optional[str] = None
    no_wa: Optional[str] = None
    usia: Optional[int] = None
    kota: Optional[str] = None
    profesi: Optional[str] = None
    pernah_trading: Optional[str] = None
    sumber: Optional[str] = None
    pendidikan: Optional[str] = None
    cv_file_id: Optional[str] = None
    cv_filename: Optional[str] = None
    status: Optional[str] = None
    catatan: Optional[str] = None
    tanggal_follow_up: Optional[str] = None
    custom: Optional[Dict[str, str]] = None


class AssignRequest(BaseModel):
    assigned_to: str


class LeadStats(BaseModel):
    total: int
    by_status: dict
    by_type: dict
    by_marketing: dict
    follow_up_today: int


class FollowUpNotification(BaseModel):
    id: str
    nama: str
    type: Literal["nasabah", "pelamar"]
    status: str
    tanggal_follow_up: str
    assigned_to_name: Optional[str] = None
    overdue: bool


class BulkAssignRequest(BaseModel):
    lead_ids: List[str]
    assigned_to: str


class BulkAssignResult(BaseModel):
    updated: int
    assigned_to_name: str


class TeamPerformance(BaseModel):
    marketing_id: Optional[str] = None
    marketing_name: str
    total: int
    open: int
    closed_won: int
    closed_lost: int
    conversion_rate: float
    target_deals: int = 0
    achieved_this_month: int = 0
    target_progress: float = 0.0


class SumberStat(BaseModel):
    """Per-channel performance: which source produces the most deals."""

    sumber: str
    total: int
    won: int
    lost: int
    open: int
    conversion_rate: float


class DealTrendPoint(BaseModel):
    """One month on the deal-trend chart."""

    month: str  # YYYY-MM
    label: str  # e.g. "Sep 2026"
    deals: int
    nasabah: int
    pelamar: int


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[str] = []


class ImportField(BaseModel):
    """One mappable lead field, described for the column-mapping screen."""

    key: str
    label: str
    required: bool


class ImportPreview(BaseModel):
    """What the admin confirms before any row is written."""

    headers: List[str]
    mapping: Dict[str, Optional[str]]  # field key -> chosen column (auto-guessed)
    fields: List[ImportField]
    sample_rows: List[Dict[str, str]]
    total_rows: int
    unmapped_headers: List[str]
    # Custom columns that already exist, so a repeat import reuses them instead of duplicating.
    existing_custom: List[ImportField] = []


class UploadedFile(BaseModel):
    file_id: str
    filename: str
    size: int
