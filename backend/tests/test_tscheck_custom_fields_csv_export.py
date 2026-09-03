"""GET /api/leads/export?type=nasabah appends custom column labels to the CSV header, and
each lead's stored custom value lands in the matching position on its row.
"""

import csv
import io
import time

from tests.helpers import ADMIN, login


def test_export_csv_includes_custom_columns_in_header_and_row():
    admin = login(*ADMIN)
    stamp = int(time.time() * 1000)
    label = f"tscheck-export-col-{stamp}"
    nama = f"tscheck-export-lead-{stamp}"

    field = admin.post("/custom-fields", json={"label": label})
    assert field.status_code == 200, field.text
    key = field.json()["key"]
    field_id = field.json()["id"]

    try:
        lead = admin.post(
            "/leads",
            json={
                "type": "nasabah",
                "nama": nama,
                "no_wa": "081400000000",
                "custom": {key: "nilai-custom-123"},
            },
        )
        assert lead.status_code == 200, lead.text
        lead_id = lead.json()["id"]

        resp = admin.get("/leads/export", params={"type": "nasabah", "search": nama})
        assert resp.status_code == 200, resp.text
        rows = list(csv.reader(io.StringIO(resp.text)))
        header = rows[0]
        assert header[-1] == label, header

        data_rows = [r for r in rows[1:] if r and r[0] == nama]
        assert len(data_rows) == 1, rows
        assert data_rows[0][-1] == "nilai-custom-123", data_rows[0]

        admin.delete(f"/leads/{lead_id}")
    finally:
        admin.delete(f"/custom-fields/{field_id}")
