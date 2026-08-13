"""Criterion: Notification list excludes closed leads (terminal statuses)."""

import uuid
from datetime import date, timedelta

from .helpers import RINA, login


def _make_lead(client, status: str, follow_up: str) -> str:
    payload = {
        "type": "nasabah",
        "nama": f"tscheck-notif-excl-{uuid.uuid4().hex[:8]}",
        "no_hp": "081234567890",
        "sumber": "Website QuickPro",
        "status": status,
        "tanggal_follow_up": follow_up,
    }
    resp = client.post("/leads", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"], payload["nama"]


def test_closed_lead_with_overdue_followup_not_in_notifications():
    client = login(*RINA)
    overdue_date = (date.today() - timedelta(days=3)).isoformat()

    # Terminal status "Deal" with an overdue follow-up date must never appear.
    lead_id, name = _make_lead(client, "Deal", overdue_date)

    resp = client.get("/leads/notifications")
    assert resp.status_code == 200, resp.text
    ids = [n["id"] for n in resp.json()]
    assert lead_id not in ids, f"closed lead {name} unexpectedly present in notifications: {resp.text[:500]}"


def test_open_lead_with_overdue_followup_is_in_notifications():
    client = login(*RINA)
    overdue_date = (date.today() - timedelta(days=3)).isoformat()

    # Same overdue date but an open status ("Follow Up") must appear as evidence the
    # exclusion is status-driven, not date-driven.
    lead_id, name = _make_lead(client, "Follow Up", overdue_date)

    resp = client.get("/leads/notifications")
    assert resp.status_code == 200, resp.text
    ids = [n["id"] for n in resp.json()]
    assert lead_id in ids, f"open overdue lead {name} missing from notifications: {resp.text[:500]}"
