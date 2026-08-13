"""Audit log of every lead hand-over between marketing users."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends

from lib.auth import get_current_admin
from lib.db import db
from models.ops import Transfer

router = APIRouter()


async def log_transfers(leads: List[dict], target: dict, actor: dict, mode: str) -> None:
    """Record one entry per lead that actually changed hands. Called by the leads router."""
    now = datetime.now(timezone.utc)
    entries = [
        Transfer(
            lead_id=lead["id"],
            lead_nama=lead["nama"],
            from_id=lead.get("assigned_to"),
            from_name=lead.get("assigned_to_name") or "Belum Ditugaskan",
            to_id=target["id"],
            to_name=target["name"],
            by_id=actor["id"],
            by_name=actor["name"],
            mode=mode,
            created_at=now,
        ).model_dump()
        for lead in leads
        if lead.get("assigned_to") != target["id"]
    ]
    if entries:
        await db.transfers.insert_many(entries)


@router.get("/transfers", response_model=List[Transfer])
async def list_transfers(
    lead_id: Optional[str] = None,
    mode: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
):
    query: dict = {}
    if lead_id:
        query["lead_id"] = lead_id
    if mode:
        query["mode"] = mode
    docs = await db.transfers.find(query).sort("created_at", -1).to_list(1000)
    return [Transfer(**d) for d in docs]
