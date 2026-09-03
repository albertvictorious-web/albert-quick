"""C4 (API): a column left unmapped rides along as a progress note on the created lead,
prefixed 'Data tambahan dari file import' and containing 'column: value'."""

import io
import json
import uuid

import openpyxl

from .helpers import ADMIN, login

UNIQUE = uuid.uuid4().hex[:8]
NAMA = f"tscheck-import-note-{UNIQUE}"

HEADERS = ["Nama Lengkap", "No. HP / WhatsApp", "Kode Referensi"]
ROW = [NAMA, "081233334444", "REF-001"]


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(HEADERS)
    ws.append(ROW)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_unmapped_column_becomes_progress_note():
    client = login(*ADMIN)
    files = {"file": ("leads.xlsx", build_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    mapping = {"nama": "Nama Lengkap", "no_wa": "No. HP / WhatsApp"}
    resp = client.post(
        "/leads/import",
        files=files,
        data={"mapping": json.dumps(mapping), "lead_type": "nasabah"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1

    search = client.get("/leads", params={"type": "nasabah", "search": NAMA})
    assert search.status_code == 200, search.text
    leads = search.json()
    assert len(leads) == 1
    lead = leads[0]

    detail = client.get(f"/leads/{lead['id']}")
    assert detail.status_code == 200, detail.text
    notes = detail.json()["notes"]
    assert len(notes) == 1
    text = notes[0]["text"]
    assert text.startswith("Data tambahan dari file import")
    assert "Kode Referensi: REF-001" in text
