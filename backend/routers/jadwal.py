"""Prospecting schedules. Marketing manages their own; admin sees and manages the whole team."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user
from lib.db import db
from models.ops import Jadwal, JadwalCreate, JadwalReminder, JadwalUpdate, RekapProspek

router = APIRouter()

KENDARAAN_OPTIONS = [
    "Mobil Pribadi",
    "Motor",
    "Kendaraan Kantor",
    "Transportasi Online",
    "Lainnya",
]
STATUS_OPTIONS = ["Terjadwal", "Selesai", "Dibatalkan"]


# Appointment times are entered in local Indonesian time (WIB = UTC+7), so the reminder
# window is computed against a WIB "now" rather than raw UTC.
WIB = timedelta(hours=7)


def now_wib() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) + WIB


def today_iso() -> str:
    """Server-anchored today (WIB) so a client clock can't shift the reminder window."""
    return now_wib().date().isoformat()


def check_owner(doc: dict, user: dict):
    if user["role"] != "admin" and doc["marketing_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke jadwal ini")


@router.get("/jadwal/reminders", response_model=List[JadwalReminder])
async def jadwal_reminders(user: dict = Depends(get_current_user)):
    """Appointments still marked Terjadwal whose date is today or already past.

    Role-scoped like /jadwal: marketing only ever sees their own agenda.
    """
    today = today_iso()
    tomorrow = (now_wib() + timedelta(days=1)).date().isoformat()
    # Today (and anything overdue) plus tomorrow, so a 23:30 appointment still gets its
    # one-hour-ahead nudge at 22:30 today. Tomorrow's rows are filtered to the <=60min window.
    query: dict = {"status": "Terjadwal", "tanggal": {"$lte": tomorrow}}
    if user["role"] == "marketing":
        query["marketing_id"] = user["id"]
    docs = await db.jadwal.find(query).sort([("tanggal", 1), ("jam", 1)]).to_list(200)

    now = now_wib()
    out: list = []
    for d in docs:
        try:
            starts = datetime.strptime(f"{d['tanggal']} {d['jam']}", "%Y-%m-%d %H:%M")
            minutes = int((starts - now).total_seconds() // 60)
        except ValueError:
            minutes = 0
        out.append(
            JadwalReminder(
                id=d["id"],
                client_nama=d["client_nama"],
                marketing_name=d["marketing_name"],
                lokasi=d["lokasi"],
                tanggal=d["tanggal"],
                jam=d["jam"],
                kendaraan=d["kendaraan"],
                overdue=d["tanggal"] < today,
                soon=0 <= minutes <= 60,
                minutes_until=minutes,
            )
        )
    today_str = today
    return [r for r in out if r.tanggal <= today_str or r.soon]


@router.get("/jadwal/rekap", response_model=List[RekapProspek])
async def jadwal_rekap(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Monthly appointment recap. Admin gets every marketing user, marketing gets only itself."""
    m = month or datetime.now(timezone.utc).strftime("%Y-%m")
    if user["role"] == "admin":
        people = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    else:
        people = [user]

    result: list = []
    for person in people:
        docs = await db.jadwal.find(
            {"marketing_id": person["id"], "tanggal": {"$regex": f"^{m}"}}
        ).to_list(2000)
        result.append(
            RekapProspek(
                marketing_id=person["id"],
                marketing_name=person["name"],
                month=m,
                total=len(docs),
                terjadwal=sum(1 for d in docs if d["status"] == "Terjadwal"),
                selesai=sum(1 for d in docs if d["status"] == "Selesai"),
                dibatalkan=sum(1 for d in docs if d["status"] == "Dibatalkan"),
                ada_hasil=sum(1 for d in docs if (d.get("hasil_pertemuan") or "").strip()),
            )
        )
    return result


@router.get("/jadwal", response_model=List[Jadwal])
async def list_jadwal(
    status: Optional[str] = None,
    marketing_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if user["role"] == "marketing":
        query["marketing_id"] = user["id"]
    elif marketing_id:
        query["marketing_id"] = marketing_id
    if status:
        query["status"] = status
    docs = await db.jadwal.find(query).sort([("tanggal", 1), ("jam", 1)]).to_list(2000)
    return [Jadwal(**d) for d in docs]


@router.post("/jadwal", response_model=Jadwal)
async def create_jadwal(body: JadwalCreate, user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        if not body.marketing_id:
            raise HTTPException(status_code=400, detail="Pilih marketing untuk jadwal ini")
        owner = await db.users.find_one({"id": body.marketing_id, "role": "marketing"})
        if not owner:
            raise HTTPException(status_code=400, detail="Akun marketing tidak ditemukan")
    else:
        owner = user

    if body.kendaraan not in KENDARAAN_OPTIONS:
        raise HTTPException(status_code=400, detail="Pilihan kendaraan tidak valid")

    jadwal = Jadwal(
        client_nama=body.client_nama,
        marketing_id=owner["id"],
        marketing_name=owner["name"],
        lokasi=body.lokasi,
        tanggal=body.tanggal,
        jam=body.jam,
        kendaraan=body.kendaraan,
        lead_id=body.lead_id,
        created_by=user["id"],
        created_by_name=user["name"],
    )
    await db.jadwal.insert_one(jadwal.model_dump())
    return jadwal


@router.patch("/jadwal/{jadwal_id}", response_model=Jadwal)
async def update_jadwal(
    jadwal_id: str, body: JadwalUpdate, user: dict = Depends(get_current_user)
):
    doc = await db.jadwal.find_one({"id": jadwal_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    check_owner(doc, user)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "status" in updates and updates["status"] not in STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="Status jadwal tidak valid")
    if "kendaraan" in updates and updates["kendaraan"] not in KENDARAAN_OPTIONS:
        raise HTTPException(status_code=400, detail="Pilihan kendaraan tidak valid")
    # Reporting the meeting outcome closes the appointment unless told otherwise.
    if updates.get("hasil_pertemuan") and "status" not in updates:
        updates["status"] = "Selesai"

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.jadwal.update_one({"id": jadwal_id}, {"$set": updates})
    doc = await db.jadwal.find_one({"id": jadwal_id})
    return Jadwal(**doc)


@router.delete("/jadwal/{jadwal_id}")
async def delete_jadwal(jadwal_id: str, user: dict = Depends(get_current_user)):
    doc = await db.jadwal.find_one({"id": jadwal_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    check_owner(doc, user)
    await db.jadwal.delete_one({"id": jadwal_id})
    return {"message": "Jadwal dihapus"}
