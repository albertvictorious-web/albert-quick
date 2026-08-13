from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_admin, get_current_user
from lib.db import db
from models.lead import (
    AssignRequest,
    Lead,
    LeadCreate,
    LeadStats,
    LeadUpdate,
    NoteCreate,
    ProgressNote,
)
from models.user import UserPublic

router = APIRouter()


@router.get("/leads/assignable-marketing", response_model=List[UserPublic])
async def assignable_marketing(user: dict = Depends(get_current_user)):
    """Any authenticated user can see the marketing roster to assign/transfer a lead."""
    users = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    return [UserPublic(**u) for u in users]


async def get_lead_or_404(lead_id: str) -> dict:
    doc = await db.leads.find_one({"id": lead_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Leads tidak ditemukan")
    return doc


def check_access(doc: dict, user: dict):
    if user["role"] == "marketing" and doc.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke leads ini")


@router.get("/leads", response_model=List[Lead])
async def list_leads(
    type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
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
        if d.get("tanggal_follow_up") and d["tanggal_follow_up"] <= today:
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
    update: dict = {
        "$push": {"notes": note.model_dump()},
        "$set": {"updated_at": datetime.now(timezone.utc)},
    }
    if body.status:
        update["$set"]["status"] = body.status
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
    doc = await get_lead_or_404(lead_id)
    return Lead(**doc)


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leads tidak ditemukan")
    return {"message": "Leads dihapus"}
