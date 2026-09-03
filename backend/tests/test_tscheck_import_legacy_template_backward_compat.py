"""C7: the legacy template CSV (no mapping field) still imports unchanged — backward
compatibility with the pre-mapping API contract."""

from .helpers import ADMIN, login


def test_legacy_template_csv_imports_without_mapping():
    client = login(*ADMIN)

    template = client.get("/leads/import-template")
    assert template.status_code == 200, template.text
    csv_bytes = template.content
    assert b"tipe" in csv_bytes

    files = {"file": ("template-import-leads.csv", csv_bytes, "text/csv")}
    resp = client.post("/leads/import", files=files, data={"lead_type": "nasabah"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["skipped"] == 0
