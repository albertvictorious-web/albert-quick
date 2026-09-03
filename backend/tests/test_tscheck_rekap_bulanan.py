"""Rekap Bulanan: current-month figures, month-picker re-query, and CSV export."""

from .helpers import login, ADMIN, RINA


def test_rekap_bulanan_current_month_admin():
    client = login(*ADMIN)
    resp = client.get("/rekap/bulanan", params={"month": "2026-09"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["label"] == "September 2026"
    assert data["total_leads_masuk"] == 21
    assert data["total_deals"] == 4
    assert data["total_jadwal"] == 3
    assert data["total_jadwal_selesai"] == 1
    per_marketing = {row["marketing_name"]: row for row in data["per_marketing"]}
    assert len(data["per_marketing"]) == 3
    assert per_marketing["Budi Santoso"]["deals"] == 2
    assert per_marketing["Rina Marlina"]["deals"] == 1
    assert per_marketing["Siti Aminah"]["deals"] == 1
    assert len(data["per_sumber"]) > 0


def test_rekap_bulanan_month_picker_empty_period():
    client = login(*ADMIN)
    resp = client.get("/rekap/bulanan", params={"month": "2026-01"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["label"] == "Januari 2026"
    assert data["total_leads_masuk"] == 0
    assert data["total_deals"] == 0
    assert data["total_jadwal"] == 0
    assert data["total_jadwal_selesai"] == 0
    assert data["per_sumber"] == []


def test_rekap_export_csv_admin():
    client = login(*ADMIN)
    resp = client.get("/rekap/export", params={"month": "2026-09"})
    assert resp.status_code == 200, resp.text
    assert "text/csv" in resp.headers.get("content-type", "")
    assert "attachment" in resp.headers.get("content-disposition", "")
    body = resp.text
    assert "RINGKASAN" in body
    assert "PER MARKETING" in body
    assert "Budi Santoso" in body


def test_rekap_bulanan_forbidden_for_marketing():
    client = login(*RINA)
    resp = client.get("/rekap/bulanan", params={"month": "2026-09"})
    assert resp.status_code == 403, resp.text
