"""Criterion: adding a progress note that closes a lead removes it from notifications."""

import uuid
from datetime import date, timedelta

from .helpers import RINA, login


def test_note_with_terminal_status_removes_lead_from_notifications():
    client = login(*RINA)
    overdue_date = (date.today() - timedelta(days=1)).isoformat()
    payload = {
        "type": "nasabah",
        "nama": f"tscheck-noteclose-{uuid.uuid4().hex[:8]}",
        "no_hp": "081234567892",
        "sumber": "Website QuickPro",
        "status": "Follow Up",
        "tanggal_follow_up": overdue_date,
    }
    created = client.post("/leads", json=payload)
    assert created.status_code == 200, created.text
    lead_id = created.json()["id"]

    before = client.get("/leads/notifications")
    assert lead_id in [n["id"] for n in before.json()]

    note_resp = client.post(
        f"/leads/{lead_id}/notes",
        json={"text": "Nasabah setuju, deal.", "status": "Deal"},
    )
    assert note_resp.status_code == 200, note_resp.text
    assert note_resp.json()["status"] == "Deal"

    after = client.get("/leads/notifications")
    assert after.status_code == 200
    ids = [n["id"] for n in after.json()]
    assert lead_id not in ids, f"lead still present after closing note: {after.text[:500]}"
