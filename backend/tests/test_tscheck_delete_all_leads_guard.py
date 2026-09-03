"""Server-side guard on DELETE /api/leads/all: bad confirm, role, and no-session cases.

The actual full destructive wipe (used by the UI flow) is exercised in the browser check
`delete-all-leads-full-flow`; this file only proves the guard rejects everything short of the
exact admin + confirm=HAPUS combination, and that nothing gets deleted along the way.
"""

import time

import httpx

from tests.helpers import ADMIN, RINA, login

BASE_URL = "http://localhost:8001/api"


def _make_fixture_lead(client: httpx.Client) -> str:
    stamp = int(time.time() * 1000)
    resp = client.post(
        "/leads",
        json={
            "type": "nasabah",
            "nama": f"tscheck-deleteallguard-{stamp}",
            "no_wa": "081600000000",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_delete_all_no_confirm_param_rejected_and_nondestructive():
    admin = login(*ADMIN)
    fixture_id = _make_fixture_lead(admin)

    resp = admin.delete("/leads/all")
    assert resp.status_code == 400, resp.text
    assert "HAPUS" in resp.json()["detail"]

    still_there = admin.get(f"/leads/{fixture_id}")
    assert still_there.status_code == 200, "the fixture lead must survive a rejected delete-all"

    admin.delete(f"/leads/{fixture_id}")


def test_delete_all_lowercase_confirm_rejected_and_nondestructive():
    admin = login(*ADMIN)
    fixture_id = _make_fixture_lead(admin)

    resp = admin.delete("/leads/all", params={"confirm": "hapus"})
    assert resp.status_code == 400, resp.text

    still_there = admin.get(f"/leads/{fixture_id}")
    assert still_there.status_code == 200, "the fixture lead must survive a rejected delete-all"

    admin.delete(f"/leads/{fixture_id}")


def test_delete_all_marketing_forbidden():
    rina = login(*RINA)
    resp = rina.delete("/leads/all", params={"confirm": "HAPUS"})
    assert resp.status_code == 403, resp.text


def test_delete_all_no_session_unauthorized():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as anon:
        resp = anon.delete("/leads/all", params={"confirm": "HAPUS"})
        assert resp.status_code == 401, resp.text
