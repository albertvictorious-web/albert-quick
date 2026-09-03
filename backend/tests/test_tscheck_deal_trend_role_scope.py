"""Deal trend chart data: admin sees full totals, marketing user sees only their own."""

from .helpers import login, ADMIN, RINA


def test_deal_trend_admin_sep_2026():
    client = login(*ADMIN)
    resp = client.get("/leads/deal-trend")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 6
    sep = next(p for p in data if p["month"] == "2026-09")
    assert sep["label"] == "Sep 2026"
    assert sep["deals"] == 4
    aug = next(p for p in data if p["month"] == "2026-08")
    assert aug["deals"] == 0


def test_deal_trend_marketing_scoped_to_own_leads():
    client = login(*RINA)
    resp = client.get("/leads/deal-trend")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    sep = next(p for p in data if p["month"] == "2026-09")
    # Rina's own leads only: expected 1 deal, must never exceed admin's total of 4
    assert sep["deals"] <= 4
    assert sep["deals"] == 1
