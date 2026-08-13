"""Monthly deal targets per marketing user, plus the achieved-this-month progress."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_admin, get_current_user
from lib.db import db
from models.ops import MarketingTarget, TargetUpsert

router = APIRouter()

WON_STATUSES = {"Deal", "Diterima"}


def current_month() -> str:
    """Server-anchored current month (pod clock is UTC)."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def month_of(doc: dict) -> Optional[str]:
    """Month a lead was won. closed_at is set on the winning status change; older
    rows fall back to updated_at. Motor hands back naive datetimes — no tz math here."""
    dt = doc.get("closed_at") or doc.get("updated_at")
    if not isinstance(dt, datetime):
        return None
    return dt.strftime("%Y-%m")


async def achieved_for(marketing_id: str, month: str) -> int:
    docs = await db.leads.find(
        {"assigned_to": marketing_id, "status": {"$in": list(WON_STATUSES)}}
    ).to_list(5000)
    return sum(1 for d in docs if month_of(d) == month)


async def build_target(user: dict, month: str) -> MarketingTarget:
    row = await db.targets.find_one({"marketing_id": user["id"], "month": month})
    target_deals = int(row["target_deals"]) if row else 0
    achieved = await achieved_for(user["id"], month)
    return MarketingTarget(
        marketing_id=user["id"],
        marketing_name=user["name"],
        month=month,
        target_deals=target_deals,
        achieved=achieved,
        progress=round(achieved / target_deals * 100, 1) if target_deals else 0.0,
    )


@router.get("/targets/me", response_model=MarketingTarget)
async def my_target(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user["role"] != "marketing":
        raise HTTPException(status_code=400, detail="Target hanya berlaku untuk akun marketing")
    return await build_target(user, month or current_month())


@router.get("/targets", response_model=List[MarketingTarget])
async def list_targets(month: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    m = month or current_month()
    users = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    return [await build_target(u, m) for u in users]


@router.put("/targets", response_model=MarketingTarget)
async def upsert_target(body: TargetUpsert, admin: dict = Depends(get_current_admin)):
    if body.target_deals < 0:
        raise HTTPException(status_code=400, detail="Target tidak boleh negatif")
    target_user = await db.users.find_one({"id": body.marketing_id, "role": "marketing"})
    if not target_user:
        raise HTTPException(status_code=400, detail="Akun marketing tidak ditemukan")
    await db.targets.update_one(
        {"marketing_id": body.marketing_id, "month": body.month},
        {
            "$set": {
                "target_deals": body.target_deals,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"id": str(uuid.uuid4())},
        },
        upsert=True,
    )
    return await build_target(target_user, body.month)
