"""C8 (API): bad input and role scope are rejected on /api/leads/import/preview.

- a non-spreadsheet file -> 400 with an Indonesian message
- no session -> 401
- marketing role -> 403
"""

import httpx

from .helpers import ADMIN, RINA, login

BASE_URL = "http://localhost:8001/api"


def test_non_spreadsheet_file_returns_400_indonesian_message():
    client = login(*ADMIN)
    files = {"file": ("notes.pdf", b"%PDF-1.4 not a spreadsheet", "application/pdf")}
    resp = client.post("/leads/import/preview", files=files)
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert any(word in detail.lower() for word in ["file", "format", "kolom", "kosong", "dukung"])


def test_no_session_returns_401():
    anon = httpx.Client(base_url=BASE_URL, timeout=30.0)
    files = {"file": ("x.csv", b"nama,no_wa\na,b\n", "text/csv")}
    resp = anon.post("/leads/import/preview", files=files)
    assert resp.status_code == 401, resp.text


def test_marketing_role_returns_403():
    client = login(*RINA)
    files = {"file": ("x.csv", b"nama,no_wa\na,b\n", "text/csv")}
    resp = client.post("/leads/import/preview", files=files)
    assert resp.status_code == 403, resp.text
