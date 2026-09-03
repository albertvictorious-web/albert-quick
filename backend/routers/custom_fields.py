"""Admin-defined extra lead columns, so the app can follow whatever the client's file uses."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_admin, get_current_user
from lib.db import db
from models.custom_field import CustomField, CustomFieldCreate, CustomFieldUpdate, slugify

router = APIRouter()

MAX_FIELDS = 30


async def list_definitions() -> List[dict]:
    return await db.custom_fields.find({}).sort("created_at", 1).to_list(MAX_FIELDS * 2)


async def ensure_field(label: str) -> dict:
    """Find a definition by label (case-insensitive) or create it. Used by the importer."""
    clean = (label or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Nama kolom tidak boleh kosong")
    existing = await db.custom_fields.find_one({"label": {"$regex": f"^{_escape(clean)}$", "$options": "i"}})
    if existing:
        return existing

    if await db.custom_fields.count_documents({}) >= MAX_FIELDS:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_FIELDS} kolom custom")

    key = slugify(clean)
    # A different label can slugify to the same key, so keep the key unique on its own.
    if await db.custom_fields.find_one({"key": key}):
        suffix = 2
        while await db.custom_fields.find_one({"key": f"{key}_{suffix}"}):
            suffix += 1
        key = f"{key}_{suffix}"

    field = CustomField(key=key, label=clean)
    await db.custom_fields.insert_one(field.model_dump())
    return field.model_dump()


def _escape(value: str) -> str:
    import re

    return re.escape(value)


@router.get("/custom-fields", response_model=List[CustomField])
async def get_custom_fields(user: dict = Depends(get_current_user)):
    """Everyone reads the definitions — marketing needs them to fill the lead form."""
    return [CustomField(**doc) for doc in await list_definitions()]


@router.post("/custom-fields", response_model=CustomField)
async def create_custom_field(body: CustomFieldCreate, admin: dict = Depends(get_current_admin)):
    clean = body.label.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Nama kolom tidak boleh kosong")
    if await db.custom_fields.find_one({"label": {"$regex": f"^{_escape(clean)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail=f"Kolom '{clean}' sudah ada")
    return CustomField(**await ensure_field(clean))


@router.patch("/custom-fields/{field_id}", response_model=CustomField)
async def rename_custom_field(
    field_id: str, body: CustomFieldUpdate, admin: dict = Depends(get_current_admin)
):
    """Only the label moves; the storage key stays so existing lead values survive."""
    doc = await db.custom_fields.find_one({"id": field_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Kolom tidak ditemukan")
    clean = body.label.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Nama kolom tidak boleh kosong")
    clash = await db.custom_fields.find_one(
        {"label": {"$regex": f"^{_escape(clean)}$", "$options": "i"}, "id": {"$ne": field_id}}
    )
    if clash:
        raise HTTPException(status_code=400, detail=f"Kolom '{clean}' sudah ada")
    await db.custom_fields.update_one({"id": field_id}, {"$set": {"label": clean}})
    return CustomField(**{**doc, "label": clean})


@router.delete("/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, admin: dict = Depends(get_current_admin)):
    doc = await db.custom_fields.find_one({"id": field_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Kolom tidak ditemukan")
    await db.custom_fields.delete_one({"id": field_id})
    # Drop the stored values too, otherwise every lead keeps an orphan key forever.
    await db.leads.update_many({}, {"$unset": {f"custom.{doc['key']}": ""}})
    return {"message": f"Kolom '{doc['label']}' dihapus"}
