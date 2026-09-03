"""C3 (API): confirming a mapping via POST /api/leads/import creates the leads, and they are
then findable through GET /api/leads search — same as the Nasabah table search box."""

import io
import uuid

import openpyxl

from .helpers import ADMIN, login

UNIQUE = uuid.uuid4().hex[:8]
NAMA = f"tscheck-import-confirm-{UNIQUE}"

HEADERS = ["Nama Lengkap", "No. HP / WhatsApp", "Umur", "Kota Domisili"]
ROWS = [
    [NAMA, "081211112222", "28", "Bandung"],
]


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(HEADERS)
    for r in ROWS:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_confirm_creates_and_finds_leads():
    client = login(*ADMIN)
    xlsx_bytes = build_xlsx()

    files = {"file": ("leads.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    mapping = {
        "nama": "Nama Lengkap",
        "no_wa": "No. HP / WhatsApp",
        "usia": "Umur",
        "kota": "Kota Domisili",
    }
    resp = client.post(
        "/leads/import",
        files=files,
        data={"mapping": __import__("json").dumps(mapping), "lead_type": "nasabah"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert body["skipped"] == 0

    search = client.get("/leads", params={"type": "nasabah", "search": NAMA})
    assert search.status_code == 200, search.text
    leads = search.json()
    assert len(leads) == 1
    assert leads[0]["nama"] == NAMA
    assert leads[0]["kota"] == "Bandung"
