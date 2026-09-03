"""C6 (API): a bad mapping that never resolves 'nama'/'no_wa' is rejected with 400."""

import io
import json

import openpyxl

from .helpers import ADMIN, login

HEADERS = ["Umur"]
ROW = ["30"]


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(HEADERS)
    ws.append(ROW)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_rejects_missing_required_mapping():
    client = login(*ADMIN)
    files = {"file": ("leads.xlsx", build_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    mapping = {"no_wa": "Umur"}
    resp = client.post(
        "/leads/import",
        files=files,
        data={"mapping": json.dumps(mapping), "lead_type": "nasabah"},
    )
    assert resp.status_code == 400, resp.text
