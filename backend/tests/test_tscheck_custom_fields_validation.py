"""Custom-field create/rename validation: duplicate and empty labels are both rejected (400).

Happy-path create/rename/delete plus the UI is covered by the `custom-fields-crud` browser
check; this file focuses on the server-side validation edge cases.
"""

import time

from tests.helpers import ADMIN, login


def test_custom_field_duplicate_and_empty_label_rejected():
    admin = login(*ADMIN)
    label = f"tscheck-customfield-dup-{int(time.time() * 1000)}"

    created = admin.post("/custom-fields", json={"label": label})
    assert created.status_code == 200, created.text
    field_id = created.json()["id"]

    try:
        dup = admin.post("/custom-fields", json={"label": label})
        assert dup.status_code == 400, dup.text

        dup_case = admin.post("/custom-fields", json={"label": label.upper()})
        assert dup_case.status_code == 400, dup_case.text

        empty = admin.post("/custom-fields", json={"label": "   "})
        assert empty.status_code == 400, empty.text

        empty_rename = admin.patch(f"/custom-fields/{field_id}", json={"label": "  "})
        assert empty_rename.status_code == 400, empty_rename.text
    finally:
        admin.delete(f"/custom-fields/{field_id}")
