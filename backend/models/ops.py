import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AutoDistributeRequest(BaseModel):
    marketing_ids: list[str]
    type: Optional[str] = None


class AutoDistributeResult(BaseModel):
    distributed: int
    per_marketing: dict
