"""POST /api/leads/import with custom_columns turns leftover headers into real custom fields.

Uploads a small CSV with two headers the app doesn't know ('Kode Referensi', 'Alamat Lengkap')
and asks to keep both as custom columns. Verifies the fields get created (or reused) and the
imported lead's `custom` dict carries both values.
"""

import io
import json
import time

from tests.helpers import ADMIN, login


def test_import_promotes_leftover_columns_to_custom_fields():
    admin = login(*ADMIN)
    stamp = int(time.time() * 1000)
    nama = f"tscheck-import-promote-{stamp}"
    ref_label = f"tscheck-Kode Referensi-{stamp}"
    addr_label = f"tscheck-Alamat Lengkap-{stamp}"

    csv_bytes = (
        "Nama Lengkap,No. HP / WhatsApp,Kode Referensi,Alamat Lengkap\n"
        f"{nama},081200000{stamp % 1000:03d},REF-{stamp},Jl. Testing No. {stamp % 100}\n"
    ).encode("utf-8")

    mapping = {"nama": "Nama Lengkap", "no_wa": "No. HP / WhatsApp"}
    custom_columns = [
        {"column": "Kode Referensi", "label": ref_label},
        {"column": "Alamat Lengkap", "label": addr_label},
    ]

    resp = admin.post(
        "/leads/import",
        data={
            "mapping": json.dumps(mapping),
            "lead_type": "nasabah",
            "custom_columns": json.dumps(custom_columns),
        },
        files={"file": ("leads.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1, body

    fields = admin.get("/custom-fields").json()
    labels = {f["label"]: f["key"] for f in fields}
    assert ref_label in labels, labels
    assert addr_label in labels, labels

    leads = admin.get("/leads", params={"type": "nasabah", "search": nama}).json()
    assert len(leads) == 1, leads
    lead = leads[0]
    custom = lead.get("custom") or {}
    assert custom.get(labels[ref_label]) == f"REF-{stamp}", custom
    assert custom.get(labels[addr_label]) == f"Jl. Testing No. {stamp % 100}", custom

    # cleanup
    admin.delete(f"/leads/{lead['id']}")
    for key in (labels[ref_label], labels[addr_label]):
        field = next(f for f in fields if f["key"] == key)
        admin.delete(f"/custom-fields/{field['id']}")
