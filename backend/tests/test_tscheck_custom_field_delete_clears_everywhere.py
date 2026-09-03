"""DELETE /api/custom-fields/{id} clears the key from every lead's `custom` object without
breaking the lead record itself.
"""

import time

from tests.helpers import ADMIN, login


def test_delete_custom_field_clears_value_from_lead():
    admin = login(*ADMIN)
    stamp = int(time.time() * 1000)
    label = f"tscheck-deletefield-{stamp}"
    nama = f"tscheck-deletefield-lead-{stamp}"

    field = admin.post("/custom-fields", json={"label": label})
    assert field.status_code == 200, field.text
    key = field.json()["key"]
    field_id = field.json()["id"]

    lead = admin.post(
        "/leads",
        json={
            "type": "nasabah",
            "nama": nama,
            "no_wa": "081500000000",
            "custom": {key: "will-be-cleared"},
        },
    )
    assert lead.status_code == 200, lead.text
    lead_id = lead.json()["id"]

    before = admin.get(f"/leads/{lead_id}").json()
    assert before["custom"].get(key) == "will-be-cleared", before

    del_resp = admin.delete(f"/custom-fields/{field_id}")
    assert del_resp.status_code == 200, del_resp.text

    after = admin.get(f"/leads/{lead_id}").json()
    assert key not in (after.get("custom") or {}), after
    assert after["nama"] == nama, "lead itself must still be intact"

    remaining_fields = admin.get("/custom-fields").json()
    assert all(f["id"] != field_id for f in remaining_fields)

    admin.delete(f"/leads/{lead_id}")
