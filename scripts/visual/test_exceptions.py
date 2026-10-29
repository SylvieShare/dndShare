"""The registry cannot label incomplete or structurally unapproved entries Approved."""
from contextlib import redirect_stderr
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from compare import main
from exceptions import read_exceptions, validate_exceptions


def example():
    # This is a fictional unit-test record, never written into the real registry.
    return {"id": "sample-platform-insets", "feature": "handbook", "formats": ["phone"],
            "states": ["collections", "record"], "difference": "Тестовое различие системных панелей.",
            "reason": "Вымышленный пример для проверки схемы.",
            "approval": {"by": "Мария (вымышленная тестовая запись)",
                         "reference": "Тестовая цитата: «пример решения для unit-теста»", "date": "2024-02-29"}}


class ExceptionRegistryTest(unittest.TestCase):
    def validate_entry(self, entry):
        return validate_exceptions({"schemaVersion": 1, "exceptions": [entry]})

    def test_empty_registry_and_complete_fictional_metadata(self):
        self.assertEqual(validate_exceptions({"schemaVersion": 1, "exceptions": []})["exceptions"], [])
        self.assertEqual(self.validate_entry(example())["exceptions"], [example()])

    def test_native_form_scope_requires_explicit_complete_metadata(self):
        entry = example()
        entry.update(feature="forms", states=["character-menu", "sheet-stat-editor"])
        self.assertEqual(self.validate_entry(entry)["exceptions"], [entry])
        for feature, states in [("handbook", ["character-menu"]), ("forms", ["collections"])]:
            invalid = copy.deepcopy(entry)
            invalid.update(feature=feature, states=states)
            with self.assertRaises(ValueError):
                self.validate_entry(invalid)

    def test_weapon_gestures_use_their_own_screenshot_states(self):
        entry = example()
        entry.update(feature="weapons", states=["sheet-weapons", "sheet-magic"])
        self.assertEqual(self.validate_entry(entry)["exceptions"], [entry])
        entry["states"]=["record"]
        with self.assertRaises(ValueError): self.validate_entry(entry)

    def test_every_entry_and_approval_field_is_required_and_unknown_keys_fail(self):
        for key in example():
            with self.subTest(key=key), self.assertRaises(ValueError):
                entry = example()
                del entry[key]
                self.validate_entry(entry)
        for key in example()["approval"]:
            with self.subTest(approval=key), self.assertRaises(ValueError):
                entry = example()
                del entry["approval"][key]
                self.validate_entry(entry)
        for target in ("entry", "approval"):
            entry = example()
            (entry if target == "entry" else entry["approval"])["unknown"] = "unaccepted"
            with self.assertRaises(ValueError):
                self.validate_entry(entry)
        for entry in ({}, None, "approved"):
            with self.assertRaises(ValueError):
                self.validate_entry(entry)

    def test_invalid_values_subsets_dates_and_identifiers_fail(self):
        cases = [("id", "Bad_ID"), ("id", "-leading"), ("id", ""),
                 ("feature", "maps"), ("formats", []), ("formats", ["phone", "phone"]),
                 ("formats", ["desktop"]), ("formats", "phone"), ("formats", [None]),
                 ("states", []), ("states", ["login"]), ("states", ["record", "record"]),
                 ("difference", " "), ("difference", "English only"),
                 ("reason", "\t"), ("reason", False)]
        for key, value in cases:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                entry = example()
                entry[key] = value
                self.validate_entry(entry)
        for key, value in (("by", " "), ("reference", ""), ("reference", None),
                           ("date", "2025-02-29"), ("date", "2024-2-29"),
                           ("date", "2024-13-01"), ("date", "0000-01-01"), ("date", 20241026)):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                entry = example()
                entry["approval"][key] = value
                self.validate_entry(entry)

    def test_duplicate_ids_root_unknown_keys_and_boolean_version_fail(self):
        for document in ({"schemaVersion": 1, "exceptions": [example(), copy.deepcopy(example())]},
                         {"schemaVersion": True, "exceptions": []},
                         {"schemaVersion": 1, "exceptions": [], "approved": True},
                         {"schemaVersion": 1, "exceptions": {}}, {}):
            with self.assertRaises(ValueError):
                validate_exceptions(document)

    def test_invalid_registry_stops_compare_before_source_read_or_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            exceptions = Path(directory) / "invalid.json"
            exceptions.write_text(json.dumps({"schemaVersion": 1, "exceptions": [{}]}))
            arguments = ["compare.py", "--exceptions", str(exceptions), "--output", directory + "/output"]
            with patch("sys.argv", arguments), patch("compare.source_identity") as identity, \
                 patch("compare.subprocess.run") as process, redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    main()
                self.assertEqual(error.exception.code, 2)
                identity.assert_not_called()
                process.assert_not_called()

    def test_duplicate_json_keys_are_rejected_before_schema_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"schemaVersion":1,"exceptions":[],"exceptions":[]}')
            with self.assertRaisesRegex(ValueError, "Duplicate.*JSON key"):
                read_exceptions(path)


if __name__ == "__main__":
    unittest.main()
