"""Personal working notes. Each marketing user owns their notes; admin reads all, edits none."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user
from lib.db import db
from models.ops import Catatan, CatatanCreate, CatatanUpdate

router = APIRouter()


async def resolve_lead(lead_id: Optional[str], user: dict) -> tuple:
    """A note may reference a lead, but only one the author is allowed to see."""
    if not lead_id:
        return None, None
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=400, detail="Leads tidak ditemukan")
    if user["role"] == "marketing" and lead.get("assigned_to") != user["id"]:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke leads ini")
    return lead["id"], lead["nama"]


@router.get("/catatan", response_model=List[Catatan])
async def list_catatan(
    user_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if user["role"] == "marketing":
        query["user_id"] = user["id"]
    elif user_id:
        query["user_id"] = user_id
    if lead_id:
        query["lead_id"] = lead_id
    docs = await db.catatan.find(query).sort("created_at", -1).to_list(1000)
    return [Catatan(**d) for d in docs]


@router.post("/catatan", response_model=Catatan)
async def create_catatan(body: CatatanCreate, user: dict = Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Judul catatan wajib diisi")
    lead_id, lead_nama = await resolve_lead(body.lead_id, user)
    note = Catatan(
        user_id=user["id"],
        user_name=user["name"],
        title=body.title,
        body=body.body,
        lead_id=lead_id,
        lead_nama=lead_nama,
    )
    await db.catatan.insert_one(note.model_dump())
    return note


@router.patch("/catatan/{catatan_id}", response_model=Catatan)
async def update_catatan(
    catatan_id: str, body: CatatanUpdate, user: dict = Depends(get_current_user)
):
    doc = await db.catatan.find_one({"id": catatan_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    # Notes are private to their author — admin has read-only visibility.
    if doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Hanya pemilik catatan yang dapat mengubahnya")

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.body is not None:
        updates["body"] = body.body
    if body.lead_id is not None:
        lead_id, lead_nama = await resolve_lead(body.lead_id or None, user)
        updates["lead_id"] = lead_id
        updates["lead_nama"] = lead_nama
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.catatan.update_one({"id": catatan_id}, {"$set": updates})
    doc = await db.catatan.find_one({"id": catatan_id})
    return Catatan(**doc)


@router.delete("/catatan/{catatan_id}")
async def delete_catatan(catatan_id: str, user: dict = Depends(get_current_user)):
    doc = await db.catatan.find_one({"id": catatan_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    if doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Hanya pemilik catatan yang dapat menghapusnya")
    await db.catatan.delete_one({"id": catatan_id})
    return {"message": "Catatan dihapus"}
