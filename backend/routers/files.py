"""CV uploads. Files live in Mongo as base64 (well under the 16MB doc cap at 5MB max),
so nothing depends on pod-local disk that would vanish on redeploy."""

import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from lib.auth import get_current_user
from lib.db import db
from models.lead import UploadedFile

router = APIRouter()

MAX_BYTES = 4 * 1024 * 1024  # 4 MB
# Kenapa 4 MB, bukan 5: Vercel Functions membatasi body request 4.5 MB. Upload
# multipart menambah header/boundary di atas ukuran file, jadi 4 MB memberi
# ruang aman. Kalau lewat, Vercel menolak request sebelum FastAPI dipanggil —
# artinya user akan lihat error platform, bukan pesan Bahasa Indonesia kita.
MAX_LABEL = "4 MB"
ALLOWED_TYPES = {"application/pdf"}


@router.post("/files/cv", response_model=UploadedFile)
async def upload_cv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"Ukuran file maksimal {MAX_LABEL}")
    filename = file.filename or "cv.pdf"
    if file.content_type not in ALLOWED_TYPES and not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Hanya file PDF yang diperbolehkan")

    doc = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "content_type": "application/pdf",
        "size": len(raw),
        "data": base64.b64encode(raw).decode("ascii"),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.files.insert_one(doc)
    return UploadedFile(file_id=doc["id"], filename=filename, size=len(raw))


@router.get("/files/{file_id}")
async def get_file(file_id: str, user: dict = Depends(get_current_user)):
    """Served inline so the browser's built-in PDF viewer can show the CV directly."""
    doc = await db.files.find_one({"id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    raw = base64.b64decode(doc["data"])
    return Response(
        content=raw,
        media_type=doc.get("content_type", "application/pdf"),
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )
