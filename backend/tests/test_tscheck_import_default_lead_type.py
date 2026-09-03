"""C5 (API): when the file has no 'tipe' column, the admin-chosen lead_type applies to
every row — rows land as 'pelamar', not the default 'nasabah'."""

import io
import json
import uuid

import openpyxl

from .helpers import ADMIN, login

UNIQUE = uuid.uuid4().hex[:8]
NAMA = f"tscheck-import-pelamar-{UNIQUE}"

HEADERS = ["Nama Lengkap", "No. HP / WhatsApp"]
ROW = [NAMA, "081255556666"]


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(HEADERS)
    ws.append(ROW)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_lead_type_choice_applies_when_no_tipe_column():
    client = login(*ADMIN)
    files = {"file": ("leads.xlsx", build_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    mapping = {"nama": "Nama Lengkap", "no_wa": "No. HP / WhatsApp"}
    resp = client.post(
        "/leads/import",
        files=files,
        data={"mapping": json.dumps(mapping), "lead_type": "pelamar"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1

    as_nasabah = client.get("/leads", params={"type": "nasabah", "search": NAMA})
    assert as_nasabah.status_code == 200
    assert as_nasabah.json() == []

    as_pelamar = client.get("/leads", params={"type": "pelamar", "search": NAMA})
    assert as_pelamar.status_code == 200
    leads = as_pelamar.json()
    assert len(leads) == 1
    assert leads[0]["type"] == "pelamar"
