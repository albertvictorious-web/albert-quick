"""Admin monthly recap: appointments, channel performance and deals per marketing in one place."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from lib.auth import get_current_admin
from lib.db import db

router = APIRouter()

WON_STATUSES = {"Deal", "Diterima"}
LOST_STATUSES = {"Gagal", "Ditolak"}
MONTH_NAMES = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
]


class RekapMarketing(BaseModel):
    marketing_id: str
    marketing_name: str
    deals: int
    leads_masuk: int
    jadwal: int
    jadwal_selesai: int
    target_deals: int
    target_progress: float


class RekapSumber(BaseModel):
    sumber: str
    type: str
    total: int
    won: int
    conversion_rate: float


class RekapBulanan(BaseModel):
    month: str
    label: str
    total_leads_masuk: int
    total_deals: int
    total_jadwal: int
    total_jadwal_selesai: int
    per_marketing: List[RekapMarketing]
    per_sumber: List[RekapSumber]


def current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def month_label(month: str) -> str:
    try:
        return f"{MONTH_NAMES[int(month[5:7]) - 1]} {month[:4]}"
    except (ValueError, IndexError):
        return month


def in_month(value: object, month: str) -> bool:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m") == month
    return False


def won_month(doc: dict) -> Optional[str]:
    stamp = doc.get("closed_at") or doc.get("updated_at")
    return stamp.strftime("%Y-%m") if isinstance(stamp, datetime) else None


async def build_rekap(month: str) -> RekapBulanan:
    people = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    leads = await db.leads.find({}).to_list(5000)
    jadwal = await db.jadwal.find({"tanggal": {"$regex": f"^{month}"}}).to_list(5000)
    target_rows = await db.targets.find({"month": month}).to_list(1000)
    targets = {t["marketing_id"]: int(t["target_deals"]) for t in target_rows}

    per_marketing: list = []
    for person in people:
        own = [l for l in leads if l.get("assigned_to") == person["id"]]
        deals = sum(1 for l in own if l["status"] in WON_STATUSES and won_month(l) == month)
        masuk = sum(1 for l in own if in_month(l.get("created_at"), month))
        mine = [j for j in jadwal if j["marketing_id"] == person["id"]]
        target = targets.get(person["id"], 0)
        per_marketing.append(
            RekapMarketing(
                marketing_id=person["id"],
                marketing_name=person["name"],
                deals=deals,
                leads_masuk=masuk,
                jadwal=len(mine),
                jadwal_selesai=sum(1 for j in mine if j["status"] == "Selesai"),
                target_deals=target,
                target_progress=round(deals / target * 100, 1) if target else 0.0,
            )
        )

    per_sumber: list = []
    for lead_type in ("nasabah", "pelamar"):
        buckets: dict = {}
        for l in leads:
            if l["type"] != lead_type or not in_month(l.get("created_at"), month):
                continue
            row = buckets.setdefault(l.get("sumber") or "Tidak Diketahui", {"total": 0, "won": 0})
            row["total"] += 1
            if l["status"] in WON_STATUSES:
                row["won"] += 1
        for key, v in buckets.items():
            per_sumber.append(
                RekapSumber(
                    sumber=key,
                    type=lead_type,
                    total=v["total"],
                    won=v["won"],
                    conversion_rate=round(v["won"] / v["total"] * 100, 1) if v["total"] else 0.0,
                )
            )
    per_sumber.sort(key=lambda s: (s.won, s.total), reverse=True)

    return RekapBulanan(
        month=month,
        label=month_label(month),
        total_leads_masuk=sum(1 for l in leads if in_month(l.get("created_at"), month)),
        total_deals=sum(m.deals for m in per_marketing),
        total_jadwal=len(jadwal),
        total_jadwal_selesai=sum(1 for j in jadwal if j["status"] == "Selesai"),
        per_marketing=per_marketing,
        per_sumber=per_sumber,
    )


@router.get("/rekap/bulanan", response_model=RekapBulanan)
async def rekap_bulanan(month: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    return await build_rekap(month or current_month())


@router.get("/rekap/export")
async def rekap_export(month: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """The same recap as a CSV the admin can archive or forward each month."""
    m = month or current_month()
    data = await build_rekap(m)

    def cell(v: object) -> str:
        return '"' + ("" if v is None else str(v)).replace('"', '""') + '"'

    lines = [
        f"Rekap Bulanan QuickPro Leads CRM — {data.label}",
        "",
        "RINGKASAN",
        ",".join(cell(x) for x in ["Leads Masuk", "Deal", "Jadwal Prospek", "Jadwal Selesai"]),
        ",".join(
            cell(x)
            for x in [
                data.total_leads_masuk,
                data.total_deals,
                data.total_jadwal,
                data.total_jadwal_selesai,
            ]
        ),
        "",
        "PER MARKETING",
        ",".join(
            cell(x)
            for x in [
                "Marketing",
                "Deal",
                "Leads Masuk",
                "Jadwal",
                "Jadwal Selesai",
                "Target Deal",
                "Progres Target (%)",
            ]
        ),
    ]
    for r in data.per_marketing:
        lines.append(
            ",".join(
                cell(x)
                for x in [
                    r.marketing_name,
                    r.deals,
                    r.leads_masuk,
                    r.jadwal,
                    r.jadwal_selesai,
                    r.target_deals,
                    r.target_progress,
                ]
            )
        )
    lines += ["", "PER SUMBER LEADS", ",".join(cell(x) for x in ["Sumber", "Tipe", "Total", "Deal", "Konversi (%)"])]
    for s in data.per_sumber:
        lines.append(
            ",".join(
                cell(x)
                for x in [
                    s.sumber,
                    "Nasabah" if s.type == "nasabah" else "Pelamar Kerja",
                    s.total,
                    s.won,
                    s.conversion_rate,
                ]
            )
        )

    body = "\ufeff" + "\n".join(lines)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="rekap-bulanan-{m}.csv"'},
    )
