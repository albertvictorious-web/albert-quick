"""Criterion: rescheduling a due lead's follow-up date removes it from notifications."""

import uuid
from datetime import date, timedelta

from .helpers import RINA, login


def test_reschedule_future_date_clears_notification():
    client = login(*RINA)
    overdue_date = (date.today() - timedelta(days=2)).isoformat()
    payload = {
        "type": "nasabah",
        "nama": f"tscheck-reschedule-{uuid.uuid4().hex[:8]}",
        "no_wa": "081234567891",
        "sumber": "Website QuickPro",
        "status": "Follow Up",
        "tanggal_follow_up": overdue_date,
    }
    created = client.post("/leads", json=payload)
    assert created.status_code == 200, created.text
    lead_id = created.json()["id"]

    before = client.get("/leads/notifications")
    assert before.status_code == 200
    assert lead_id in [n["id"] for n in before.json()]

    future_date = (date.today() + timedelta(days=30)).isoformat()
    patched = client.patch(f"/leads/{lead_id}", json={"tanggal_follow_up": future_date})
    assert patched.status_code == 200, patched.text
    assert patched.json()["tanggal_follow_up"] == future_date

    after = client.get("/leads/notifications")
    assert after.status_code == 200
    ids = [n["id"] for n in after.json()]
    assert lead_id not in ids, f"lead still present after reschedule: {after.text[:500]}"
