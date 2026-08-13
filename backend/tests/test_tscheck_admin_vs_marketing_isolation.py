"""Criterion: Admin sees team-wide notifications; marketing sees only their own leads."""

from .helpers import ADMIN, RINA, login


def test_marketing_notifications_scoped_to_self():
    rina = login(*RINA)
    resp = rina.get("/leads/notifications")
    assert resp.status_code == 200, resp.text
    items = resp.json()
    for n in items:
        assert n["assigned_to_name"] == "Rina Marlina", (
            f"marketing user saw another marketing's lead: {n}"
        )


def test_admin_notifications_cover_more_than_marketing_subset():
    admin = login(*ADMIN)
    rina = login(*RINA)

    admin_items = admin.get("/leads/notifications")
    rina_items = rina.get("/leads/notifications")
    assert admin_items.status_code == 200, admin_items.text
    assert rina_items.status_code == 200, rina_items.text

    admin_ids = {n["id"] for n in admin_items.json()}
    rina_ids = {n["id"] for n in rina_items.json()}

    # Every one of Rina's due leads must also be visible to admin (superset), and admin's
    # set must not be strictly smaller (team-wide visibility >= any single marketing's view).
    assert rina_ids.issubset(admin_ids), (
        f"admin missing leads visible to Rina: {rina_ids - admin_ids}"
    )
    assert len(admin_ids) >= len(rina_ids)
