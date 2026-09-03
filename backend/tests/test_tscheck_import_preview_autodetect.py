"""C1: POST /api/leads/import/preview auto-detects a non-template header row on a real .xlsx."""

import io

import openpyxl

from .helpers import ADMIN, login

HEADERS = [
    "Nama Lengkap",
    "No. HP / WhatsApp",
    "Umur",
    "Kota Domisili",
    "Pekerjaan",
    "Dari Mana Tahu",
    "Kode Referensi",
]

ROW = ["tscheck-import-preview Budi", "081234567890", "30", "Jakarta", "Karyawan", "Instagram", "REF-001"]


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(HEADERS)
    ws.append(ROW)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_preview_autodetects_mapping():
    client = login(*ADMIN)
    xlsx_bytes = build_xlsx()
    files = {"file": ("leads-nontemplate.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    resp = client.post("/leads/import/preview", files=files)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    mapping = body["mapping"]
    assert mapping["nama"] == "Nama Lengkap"
    assert mapping["no_wa"] == "No. HP / WhatsApp"
    assert mapping["usia"] == "Umur"
    assert mapping["kota"] == "Kota Domisili"
    assert mapping["profesi"] == "Pekerjaan"
    assert mapping["sumber"] == "Dari Mana Tahu"
    assert body["unmapped_headers"] == ["Kode Referensi"]
    assert body["total_rows"] == 1
