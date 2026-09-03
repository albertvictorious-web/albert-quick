"""When a leftover column is NOT in custom_columns, its value falls back to a progress note
instead of becoming a custom field, per the import contract in routers/leads.py.
"""

import io
import json
import time

from tests.helpers import ADMIN, login


def test_import_unclaimed_leftover_becomes_progress_note_not_custom_field():
    admin = login(*ADMIN)
    stamp = int(time.time() * 1000)
    nama = f"tscheck-import-notefallback-{stamp}"
    header = f"tscheck-Kode Referensi-{stamp}"  # unique per-run so it can't collide with a
    # same-named custom field a parallel/earlier run left behind.
    ref_value = f"REF-{stamp}"

    csv_bytes = (
        f"Nama Lengkap,No. HP / WhatsApp,{header}\n"
        f"{nama},081300000{stamp % 1000:03d},{ref_value}\n"
    ).encode("utf-8")

    mapping = {"nama": "Nama Lengkap", "no_wa": "No. HP / WhatsApp"}

    resp = admin.post(
        "/leads/import",
        data={
            "mapping": json.dumps(mapping),
            "lead_type": "nasabah",
            "custom_columns": json.dumps([]),  # nothing claimed as a custom column
        },
        files={"file": ("leads.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1, resp.json()

    fields_after = {f["label"] for f in admin.get("/custom-fields").json()}
    assert header not in fields_after, fields_after

    leads = admin.get("/leads", params={"type": "nasabah", "search": nama}).json()
    assert len(leads) == 1, leads
    lead = leads[0]
    assert not (lead.get("custom") or {}), lead.get("custom")

    detail = admin.get(f"/leads/{lead['id']}").json()
    notes = detail.get("notes") or []
    assert notes, "expected a progress note carrying the leftover column"
    note_text = notes[0]["text"]
    assert note_text.startswith("Data tambahan dari file import"), note_text
    assert f"{header}: {ref_value}" in note_text, note_text

    admin.delete(f"/leads/{lead['id']}")
