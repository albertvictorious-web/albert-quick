from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import get_current_admin, get_current_user
from lib.db import db
from models.lead import (
    AssignRequest,
    BulkAssignRequest,
    BulkAssignResult,
    FollowUpNotification,
    Lead,
    LeadCreate,
    LeadStats,
    LeadUpdate,
    NoteCreate,
    ProgressNote,
    TeamPerformance,
)
from models.ops import AutoDistributeRequest, AutoDistributeResult
from models.user import UserPublic
from routers.targets import current_month, month_of
from routers.transfers import log_transfers

router = APIRouter()

# A lead in one of these statuses is closed — it never needs another follow-up nudge.
TERMINAL_STATUSES = {"Deal", "Gagal", "Diterima", "Ditolak"}
WON_STATUSES = {"Deal", "Diterima"}
LOST_STATUSES = {"Gagal", "Ditolak"}


@router.get("/leads/team-performance", response_model=List[TeamPerformance])
async def team_performance(admin: dict = Depends(get_current_admin)):
    """Per-marketing lead totals, conversion rate and monthly-target progress. Admin-only."""
    marketing = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    buckets: dict = {
        m["id"]: {"marketing_id": m["id"], "marketing_name": m["name"], "rows": []}
        for m in marketing
    }
    unassigned: list = []

    docs = await db.leads.find({}).to_list(5000)
    for d in docs:
        owner = d.get("assigned_to")
        if owner in buckets:
            buckets[owner]["rows"].append(d)
        else:
            unassigned.append(d)

    month = current_month()
    target_rows = await db.targets.find({"month": month}).to_list(1000)
    targets = {t["marketing_id"]: int(t["target_deals"]) for t in target_rows}

    def build(name: str, rows: list, marketing_id: Optional[str]) -> TeamPerformance:
        total = len(rows)
        won = sum(1 for r in rows if r["status"] in WON_STATUSES)
        lost = sum(1 for r in rows if r["status"] in LOST_STATUSES)
        target = targets.get(marketing_id, 0) if marketing_id else 0
        achieved = sum(
            1 for r in rows if r["status"] in WON_STATUSES and month_of(r) == month
        )
        return TeamPerformance(
            marketing_id=marketing_id,
            marketing_name=name,
            total=total,
            open=total - won - lost,
            closed_won=won,
            closed_lost=lost,
            conversion_rate=round(won / total * 100, 1) if total else 0.0,
            target_deals=target,
            achieved_this_month=achieved,
            target_progress=round(achieved / target * 100, 1) if target else 0.0,
        )

    result = [build(b["marketing_name"], b["rows"], b["marketing_id"]) for b in buckets.values()]
    if unassigned:
        result.append(build("Belum Ditugaskan", unassigned, None))
    return result


@router.post("/leads/auto-distribute", response_model=AutoDistributeResult)
async def auto_distribute(body: AutoDistributeRequest, admin: dict = Depends(get_current_admin)):
    """Round-robin every unassigned lead across the marketing users the admin picked."""
    if not body.marketing_ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu marketing")
    targets = []
    for mid in body.marketing_ids:
        found = await db.users.find_one({"id": mid, "role": "marketing"})
        if not found:
            raise HTTPException(status_code=400, detail="Akun marketing tidak ditemukan")
        targets.append(found)

    query: dict = {"assigned_to": None}
    if body.type:
        query["type"] = body.type
    pool = await db.leads.find(query).sort("created_at", 1).to_list(2000)
    if not pool:
        raise HTTPException(status_code=400, detail="Tidak ada leads yang belum ditugaskan")

    now = datetime.now(timezone.utc)
    per_marketing: dict = {t["name"]: 0 for t in targets}
    for index, lead in enumerate(pool):
        target = targets[index % len(targets)]
        await db.leads.update_one(
            {"id": lead["id"]},
            {
                "$set": {
                    "assigned_to": target["id"],
                    "assigned_to_name": target["name"],
                    "updated_at": now,
                }
            },
        )
        await log_transfers([lead], target, admin, "auto")
        per_marketing[target["name"]] += 1

    return AutoDistributeResult(distributed=len(pool), per_marketing=per_marketing)


@router.get("/leads/export")
async def export_leads(
    type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """CSV export of the current filter selection. Role-scoped exactly like GET /leads."""
    docs = await db.leads.find(build_leads_query(user, type, status, assigned_to, search)).sort(
        "created_at", -1
    ).to_list(5000)

    headers = [
        "Nama",
        "Tipe",
        "No HP",
        "Email",
        "Alamat",
        "Produk",
        "Posisi",
        "NIK",
        "Tanggal Lahir",
        "Sumber",
        "Status",
        "Tanggal Follow Up",
        "Marketing",
        "Jumlah Catatan",
        "Dibuat",
    ]

    def cell(value: object) -> str:
        text = "" if value is None else str(value)
        # Minimal CSV quoting: escape embedded quotes, wrap anything with a separator.
        text = text.replace('"', '""')
        return f'"{text}"'

    lines = [",".join(cell(h) for h in headers)]
    for d in docs:
        created = d.get("created_at")
        lines.append(
            ",".join(
                cell(v)
                for v in [
                    d.get("nama"),
                    "Nasabah" if d.get("type") == "nasabah" else "Pelamar Kerja",
                    d.get("no_hp"),
                    d.get("email"),
                    d.get("alamat"),
                    d.get("produk"),
                    d.get("posisi"),
                    d.get("nik"),
                    d.get("tanggal_lahir"),
                    d.get("sumber"),
                    d.get("status"),
                    d.get("tanggal_follow_up"),
                    d.get("assigned_to_name") or "Belum Ditugaskan",
                    len(d.get("notes") or []),
                    created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else "",
                ]
            )
        )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    csv_body = "\ufeff" + "\n".join(lines)  # BOM so Excel reads UTF-8 names correctly
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="leads-quickpro-{stamp}.csv"'},
    )


@router.post("/leads/bulk-assign", response_model=BulkAssignResult)
async def bulk_assign(body: BulkAssignRequest, admin: dict = Depends(get_current_admin)):
    """Assign many leads to one marketing user in a single action. Admin-only."""
    if not body.lead_ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu leads")
    target = await db.users.find_one({"id": body.assigned_to, "role": "marketing"})
    if not target:
        raise HTTPException(status_code=400, detail="Marketing tujuan tidak ditemukan")
    previous = await db.leads.find({"id": {"$in": body.lead_ids}}).to_list(2000)
    result = await db.leads.update_many(
        {"id": {"$in": body.lead_ids}},
        {
            "$set": {
                "assigned_to": target["id"],
                "assigned_to_name": target["name"],
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    await log_transfers(previous, target, admin, "bulk")
    return BulkAssignResult(updated=result.modified_count, assigned_to_name=target["name"])


@router.get("/leads/assignable-marketing", response_model=List[UserPublic])
async def assignable_marketing(user: dict = Depends(get_current_user)):
    """Any authenticated user can see the marketing roster to assign/transfer a lead."""
    users = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    return [UserPublic(**u) for u in users]


@router.get("/leads/notifications", response_model=List[FollowUpNotification])
async def follow_up_notifications(user: dict = Depends(get_current_user)):
    """Leads whose follow-up date has arrived or passed and are still open.

    Role-scoped exactly like /leads: a marketing user only ever sees their own leads.
    """
    today = datetime.now(timezone.utc).date().isoformat()
    query: dict = {
        "tanggal_follow_up": {"$ne": None, "$lte": today},
        "status": {"$nin": list(TERMINAL_STATUSES)},
    }
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
    docs = await db.leads.find(query).sort("tanggal_follow_up", 1).to_list(200)
    return [
        FollowUpNotification(
            id=d["id"],
            nama=d["nama"],
            type=d["type"],
            status=d["status"],
            tanggal_follow_up=d["tanggal_follow_up"],
            assigned_to_name=d.get("assigned_to_name"),
            overdue=d["tanggal_follow_up"] < today,
        )
        for d in docs
    ]


async def get_lead_or_404(lead_id: str) -> dict:
    doc = await db.leads.find_one({"id": lead_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Leads tidak ditemukan")
    return doc


def check_access(doc: dict, user: dict):
    if user["role"] == "marketing" and doc.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke leads ini")


def build_leads_query(
    user: dict,
    type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """One filter definition shared by the list and CSV-export endpoints.

    Marketing scope is applied first and cannot be overridden by a query param.
    """
    query: dict = {}
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
    elif assigned_to == "unassigned":
        # Admin-only view of the pool waiting to be handed out.
        query["assigned_to"] = None
    elif assigned_to:
        query["assigned_to"] = assigned_to
    if type:
        query["type"] = type
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"nama": {"$regex": search, "$options": "i"}},
            {"no_hp": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    return query


@router.get("/leads", response_model=List[Lead])
async def list_leads(
    type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = build_leads_query(user, type, status, assigned_to, search)
    docs = await db.leads.find(query).sort("created_at", -1).to_list(2000)
    return [Lead(**d) for d in docs]


@router.get("/leads/stats", response_model=LeadStats)
async def leads_stats(user: dict = Depends(get_current_user)):
    query: dict = {}
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
    docs = await db.leads.find(query).to_list(5000)
    total = len(docs)
    by_status: dict = {}
    by_type: dict = {}
    by_marketing: dict = {}
    today = datetime.now(timezone.utc).date().isoformat()
    follow_up_today = 0
    for d in docs:
        by_status[d["status"]] = by_status.get(d["status"], 0) + 1
        by_type[d["type"]] = by_type.get(d["type"], 0) + 1
        name = d.get("assigned_to_name") or "Belum Ditugaskan"
        by_marketing[name] = by_marketing.get(name, 0) + 1
        if (
            d.get("tanggal_follow_up")
            and d["tanggal_follow_up"] <= today
            and d["status"] not in TERMINAL_STATUSES
        ):
            follow_up_today += 1
    return LeadStats(
        total=total,
        by_status=by_status,
        by_type=by_type,
        by_marketing=by_marketing,
        follow_up_today=follow_up_today,
    )


@router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    doc = await get_lead_or_404(lead_id)
    check_access(doc, user)
    return Lead(**doc)


@router.post("/leads", response_model=Lead)
async def create_lead(body: LeadCreate, user: dict = Depends(get_current_user)):
    assigned_to = body.assigned_to
    assigned_to_name = None
    if user["role"] == "marketing":
        assigned_to = user["id"]
        assigned_to_name = user["name"]
    elif assigned_to:
        target = await db.users.find_one({"id": assigned_to, "role": "marketing"})
        if not target:
            raise HTTPException(status_code=400, detail="Marketing tujuan tidak ditemukan")
        assigned_to_name = target["name"]

    now = datetime.now(timezone.utc)
    lead = Lead(
        **body.model_dump(exclude={"assigned_to"}),
        assigned_to=assigned_to,
        assigned_to_name=assigned_to_name,
        created_by=user["id"],
        created_by_name=user["name"],
        created_at=now,
        updated_at=now,
    )
    await db.leads.insert_one(lead.model_dump())
    return lead


@router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, body: LeadUpdate, user: dict = Depends(get_current_user)):
    doc = await get_lead_or_404(lead_id)
    check_access(doc, user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        new_status = updates.get("status")
        # Stamp the win date so monthly target progress can be counted per month.
        if new_status in WON_STATUSES and doc.get("status") not in WON_STATUSES:
            updates["closed_at"] = updates["updated_at"]
        await db.leads.update_one({"id": lead_id}, {"$set": updates})
    doc = await get_lead_or_404(lead_id)
    return Lead(**doc)


@router.post("/leads/{lead_id}/notes", response_model=Lead)
async def add_note(lead_id: str, body: NoteCreate, user: dict = Depends(get_current_user)):
    doc = await get_lead_or_404(lead_id)
    check_access(doc, user)
    note = ProgressNote(
        text=body.text, status=body.status, created_by=user["id"], created_by_name=user["name"]
    )
    now = datetime.now(timezone.utc)
    update: dict = {
        "$push": {"notes": note.model_dump()},
        "$set": {"updated_at": now},
    }
    if body.status:
        update["$set"]["status"] = body.status
        if body.status in WON_STATUSES and doc.get("status") not in WON_STATUSES:
            update["$set"]["closed_at"] = now
    await db.leads.update_one({"id": lead_id}, update)
    doc = await get_lead_or_404(lead_id)
    return Lead(**doc)


@router.post("/leads/{lead_id}/assign", response_model=Lead)
async def assign_lead(lead_id: str, body: AssignRequest, user: dict = Depends(get_current_user)):
    doc = await get_lead_or_404(lead_id)
    check_access(doc, user)
    target = await db.users.find_one({"id": body.assigned_to, "role": "marketing"})
    if not target:
        raise HTTPException(status_code=400, detail="Marketing tujuan tidak ditemukan")
    await db.leads.update_one(
        {"id": lead_id},
        {
            "$set": {
                "assigned_to": target["id"],
                "assigned_to_name": target["name"],
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    await log_transfers([doc], target, user, "single")
    doc = await get_lead_or_404(lead_id)
    return Lead(**doc)


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leads tidak ditemukan")
    return {"message": "Leads dihapus"}
