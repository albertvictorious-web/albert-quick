import csv
import io
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from lib.auth import get_current_admin, get_current_user
from lib.db import db
from lib.import_mapping import FIELD_KEYS, FIELD_LABELS, suggest_mapping, unmapped
from lib.tabular import TableError, parse_table
from models.lead import (
    AssignRequest,
    BulkAssignRequest,
    BulkAssignResult,
    FollowUpNotification,
    ImportField,
    ImportPreview,
    ImportResult,
    Lead,
    LeadCreate,
    LeadStats,
    LeadUpdate,
    DealTrendPoint,
    NoteCreate,
    ProgressNote,
    SumberStat,
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

# Header row of the bulk-import template.
IMPORT_COLUMNS = [
    "tipe",
    "nama",
    "no_wa",
    "usia",
    "kota",
    "profesi",
    "pernah_trading",
    "sumber",
    "pendidikan",
    "status",
    "tanggal_follow_up",
    "marketing_email",
]

# Words that tell a row apart when the file carries its own "tipe" column.
PELAMAR_HINTS = ("pelamar", "lamar", "applicant", "kandidat", "job", "karyawan", "rekrut")
NASABAH_HINTS = ("nasabah", "client", "klien", "customer", "prospek", "investor")


async def _read_upload(file: UploadFile):
    """Turn any .xlsx/.xls/.csv upload into (headers, rows) or a 400 the admin can act on."""
    raw = await file.read()
    try:
        return parse_table(file.filename or "", raw)
    except TableError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _resolve_mapping(raw: Optional[str], headers: List[str]) -> Dict[str, Optional[str]]:
    """Admin-confirmed field -> column choice; without one, fall back to the automatic guess."""
    if not raw:
        return suggest_mapping(headers)
    try:
        chosen = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Pemetaan kolom tidak valid") from exc
    if not isinstance(chosen, dict):
        raise HTTPException(status_code=400, detail="Pemetaan kolom tidak valid")
    # Anything not naming a real column is dropped rather than trusted.
    return {key: (chosen.get(key) if chosen.get(key) in headers else None) for key in FIELD_KEYS}


def _row_type(raw: str, fallback: str) -> str:
    """A per-row 'tipe' cell wins; otherwise every row takes the type the admin picked."""
    value = raw.strip().lower()
    if any(hint in value for hint in PELAMAR_HINTS):
        return "pelamar"
    if any(hint in value for hint in NASABAH_HINTS):
        return "nasabah"
    return fallback


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
    sumber: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """CSV export of the current filter selection. Role-scoped exactly like GET /leads."""
    docs = await db.leads.find(
        build_leads_query(user, type, status, assigned_to, search, sumber)
    ).sort("created_at", -1).to_list(5000)

    headers = [
        "Nama",
        "Tipe",
        "No WhatsApp",
        "Usia",
        "Kota Domisili",
        "Profesi",
        "Pernah Trading",
        "Sumber",
        "Pendidikan",
        "CV",
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
                    d.get("no_wa"),
                    d.get("usia"),
                    d.get("kota"),
                    d.get("profesi"),
                    d.get("pernah_trading"),
                    d.get("sumber"),
                    d.get("pendidikan"),
                    d.get("cv_filename") or ("Ada" if d.get("cv_file_id") else ""),
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


@router.get("/leads/import-template")
async def import_template(admin: dict = Depends(get_current_admin)):
    """Blank CSV with the exact headers POST /leads/import expects, plus one example row each."""
    headers = IMPORT_COLUMNS
    examples = [
        [
            "nasabah",
            "Contoh Nasabah",
            "081234567890",
            "35",
            "Jakarta Selatan",
            "Karyawan Swasta",
            "Belum",
            "Instagram",
            "",
            "Baru",
            "",
            "",
        ],
        [
            "pelamar",
            "Contoh Pelamar",
            "082234567890",
            "24",
            "Bandung",
            "",
            "",
            "",
            "Sarjana",
            "Baru",
            "",
            "",
        ],
    ]
    lines = [",".join(headers)] + [",".join(row) for row in examples]
    body = "\ufeff" + "\n".join(lines)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="template-import-leads.csv"'},
    )


@router.post("/leads/import/preview", response_model=ImportPreview)
async def import_preview(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    """Read any .xlsx/.xls/.csv, guess the column mapping and show the admin what will land."""
    headers, rows = await _read_upload(file)
    mapping = suggest_mapping(headers)
    return ImportPreview(
        headers=headers,
        mapping=mapping,
        fields=[ImportField(key=k, label=l, required=r) for k, l, r in FIELD_LABELS],
        sample_rows=[dict(zip(headers, row)) for row in rows[:5]],
        total_rows=len(rows),
        unmapped_headers=unmapped(headers, mapping),
    )


@router.post("/leads/import", response_model=ImportResult)
async def import_leads(
    file: UploadFile = File(...),
    mapping: Optional[str] = Form(None),
    lead_type: str = Form("nasabah"),
    admin: dict = Depends(get_current_admin),
):
    """Bulk-create leads from any spreadsheet. Bad rows are reported, good rows still land.

    `mapping` is the admin-confirmed field -> column JSON from the preview step; without it the
    automatic guess is used, which keeps the old template-shaped CSV working unchanged.
    """
    if lead_type not in ("nasabah", "pelamar"):
        raise HTTPException(status_code=400, detail="Tipe leads harus 'nasabah' atau 'pelamar'")

    headers, rows = await _read_upload(file)
    column_of = _resolve_mapping(mapping, headers)
    if not column_of.get("nama") or not column_of.get("no_wa"):
        raise HTTPException(
            status_code=400,
            detail="Kolom Nama dan No. WhatsApp belum dipilih. Tentukan keduanya di layar pemetaan kolom.",
        )
    extra_columns = unmapped(headers, column_of)

    marketing = await db.users.find({"role": "marketing"}).to_list(1000)
    by_email = {m["email"].lower(): m for m in marketing}

    created: list = []
    errors: list = []
    skipped = 0
    now = datetime.now(timezone.utc)

    for line_no, values in enumerate(rows, start=2):
        row = dict(zip(headers, values))

        def value_of(field: str, source: dict = row) -> str:
            column = column_of.get(field)
            return (source.get(column) or "").strip() if column else ""

        nama = value_of("nama")
        no_wa = value_of("no_wa")
        if not nama or not no_wa:
            skipped += 1
            errors.append(f"Baris {line_no}: nama atau no_wa kosong — dilewati")
            continue

        row_type = _row_type(value_of("tipe"), lead_type)
        usia_raw = value_of("usia")
        try:
            usia = int(float(usia_raw)) if usia_raw else None
        except ValueError:
            usia = None
            errors.append(f"Baris {line_no}: usia '{usia_raw}' bukan angka — dikosongkan")

        owner = by_email.get(value_of("marketing_email").lower())
        status = value_of("status") or "Baru"

        # Columns nobody claimed still carry meaning, so they ride along as a progress note.
        notes: List[ProgressNote] = []
        leftovers = [f"{c}: {row[c].strip()}" for c in extra_columns if (row.get(c) or "").strip()]
        if leftovers:
            notes.append(
                ProgressNote(
                    text="Data tambahan dari file import — " + " · ".join(leftovers),
                    created_by=admin["id"],
                    created_by_name=admin["name"],
                    created_at=now,
                )
            )

        lead = Lead(
            type=row_type,  # type: ignore[arg-type]
            nama=nama,
            no_wa=no_wa,
            usia=usia,
            kota=value_of("kota") or None,
            profesi=value_of("profesi") or None if row_type == "nasabah" else None,
            pernah_trading=value_of("pernah_trading") or None if row_type == "nasabah" else None,
            sumber=value_of("sumber") or None if row_type == "nasabah" else None,
            pendidikan=value_of("pendidikan") or None if row_type == "pelamar" else None,
            status=status,
            catatan=value_of("catatan") or None,
            tanggal_follow_up=value_of("tanggal_follow_up") or None,
            assigned_to=owner["id"] if owner else None,
            assigned_to_name=owner["name"] if owner else None,
            created_by=admin["id"],
            created_by_name=admin["name"],
            created_at=now,
            updated_at=now,
            notes=notes,
        )
        created.append(lead.model_dump())

    if created:
        await db.leads.insert_many(created)

    return ImportResult(created=len(created), skipped=skipped, errors=errors[:20])



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


@router.get("/leads/sumber-stats", response_model=List[SumberStat])
async def sumber_stats(type: str = "nasabah", user: dict = Depends(get_current_user)):
    """Deal performance per acquisition channel, sorted by most deals won.

    Works for both lead types: nasabah = how they heard about QuickPro, pelamar = where they
    found the job opening. Role-scoped.
    """
    query: dict = {"type": type if type in ("nasabah", "pelamar") else "nasabah"}
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
    docs = await db.leads.find(query).to_list(5000)

    buckets: dict = {}
    for d in docs:
        key = d.get("sumber") or "Tidak Diketahui"
        row = buckets.setdefault(key, {"total": 0, "won": 0, "lost": 0})
        row["total"] += 1
        if d["status"] in WON_STATUSES:
            row["won"] += 1
        elif d["status"] in LOST_STATUSES:
            row["lost"] += 1

    stats = [
        SumberStat(
            sumber=key,
            total=v["total"],
            won=v["won"],
            lost=v["lost"],
            open=v["total"] - v["won"] - v["lost"],
            conversion_rate=round(v["won"] / v["total"] * 100, 1) if v["total"] else 0.0,
        )
        for key, v in buckets.items()
    ]
    stats.sort(key=lambda s: (s.won, s.total), reverse=True)
    return stats


@router.get("/leads/deal-trend", response_model=List[DealTrendPoint])
async def deal_trend(months: int = 6, user: dict = Depends(get_current_user)):
    """Won leads per month for the last N months (default 6), role-scoped.

    A win is dated by closed_at, falling back to updated_at for rows created before that
    field existed.
    """
    span = max(1, min(months, 24))
    query: dict = {"status": {"$in": list(WON_STATUSES)}}
    if user["role"] == "marketing":
        query["assigned_to"] = user["id"]
    docs = await db.leads.find(query).to_list(5000)

    now = datetime.now(timezone.utc)
    buckets: list = []
    for offset in range(span - 1, -1, -1):
        year = now.year
        month = now.month - offset
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        buckets.append({"month": key, "nasabah": 0, "pelamar": 0})
    index = {b["month"]: b for b in buckets}

    for d in docs:
        key = month_of(d)
        bucket = index.get(key or "")
        if bucket:
            bucket["nasabah" if d["type"] == "nasabah" else "pelamar"] += 1

    names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    return [
        DealTrendPoint(
            month=b["month"],
            label=f"{names[int(b['month'][5:]) - 1]} {b['month'][:4]}",
            deals=b["nasabah"] + b["pelamar"],
            nasabah=b["nasabah"],
            pelamar=b["pelamar"],
        )
        for b in buckets
    ]


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
    sumber: Optional[str] = None,
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
    if sumber:
        query["sumber"] = sumber
    if search:
        query["$or"] = [
            {"nama": {"$regex": search, "$options": "i"}},
            {"no_wa": {"$regex": search, "$options": "i"}},
            {"kota": {"$regex": search, "$options": "i"}},
        ]
    return query


@router.get("/leads", response_model=List[Lead])
async def list_leads(
    type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    sumber: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = build_leads_query(user, type, status, assigned_to, search, sumber)
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
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    """Admin may delete any lead; marketing only the leads they entered themselves."""
    doc = await get_lead_or_404(lead_id)
    if user["role"] != "admin":
        if doc.get("assigned_to") != user["id"] or doc.get("created_by") != user["id"]:
            raise HTTPException(
                status_code=403,
                detail="Anda hanya dapat menghapus leads yang Anda tambahkan sendiri",
            )
    await db.leads.delete_one({"id": lead_id})
    await db.catatan.update_many(
        {"lead_id": lead_id}, {"$set": {"lead_id": None, "lead_nama": None}}
    )
    return {"message": "Leads dihapus"}
