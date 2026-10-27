"""Behavioral checks for strict evidence, restoration and emulator safety."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib

from adb import ANIMATIONS, Emulator, PACKAGE
from android import window_metrics
from report import MATRIX, png_dimensions, render_html, validate_entries, validate_interactions
from source import source_identity


def png(width, height):
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    rows = (b"\0" + b"\x10\x20\x30" * width) * height
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


class ReviewEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        self.fixture = {"recordID": 1, "characters": [{"uuid": "dnd"}, {"uuid": "vtm"}]}
        self.entries = []
        for platform in MATRIX["platforms"]:
            (self.output / platform).mkdir()
            for format_ in MATRIX["formats"]:
                image = png(format_["width"], format_["height"])
                for state in MATRIX["states"]:
                    relative = f"{platform}/{format_['name']}-{state}.png"
                    (self.output / relative).write_bytes(image)
                    viewport = {"width": format_["width"], "height": format_["height"], "unit": "px"}
                    self.entries.append({"platform": platform, "format": format_["name"], "state": state,
                                         "file": relative, "sha256": hashlib.sha256(image).hexdigest(),
                                         "dimensions": viewport, "viewport": viewport,
                                         "recordID": 1 if state == "record" else None,
                                         "characterUUID": "dnd" if state.startswith("sheet-") else "vtm" if state == "vtm-base" else None,
                                         "insetsDp": {"top": 24}, "contentDp": {"height": format_["height"] - 24}})

    def validate(self, entries=None):
        validate_entries(self.output, self.entries if entries is None else entries, self.fixture)

    def test_complete_matrix_and_html_keep_full_images_and_exceptions(self):
        self.validate()
        manifest = {"screenshots": self.entries, "approvedExceptions": [{"reason": "<reviewed>"}],
                    "sourceSHA": "a", "sourceHash": "b", "dataFixtureHash": "c", "edition": "2014", "recordID": 1}
        rendered = render_html(manifest)
        self.assertEqual(rendered.count('<img src="'), len(self.entries))
        self.assertIn("Требуется ручная", rendered)
        self.assertIn("&lt;reviewed&gt;", rendered)
        self.assertIn("insets dp", rendered)
        self.assertNotIn("object-fit", rendered)

    def test_missing_duplicate_unexpected_and_unlisted_images_fail(self):
        for entries in (self.entries[:-1], self.entries + self.entries[:1]):
            with self.assertRaises(ValueError):
                self.validate(entries)
        extra = self.output / "web/extra.png"
        extra.write_bytes(png(1, 1))
        with self.assertRaisesRegex(ValueError, "files and manifest"):
            self.validate()

    def test_changed_pixels_wrong_dimensions_record_and_escaping_path_fail(self):
        for field, value in (("sha256", "wrong"), ("recordID", 44), ("file", "../outside.png"),
                             ("dimensions", {"width": 1, "height": 2})):
            entries = copy.deepcopy(self.entries)
            entries[0][field] = value
            with self.assertRaises((ValueError, FileNotFoundError)):
                self.validate(entries)
        data = png(10, 20)
        self.assertEqual(png_dimensions(data), (10, 20))
        for broken in (data[:-5], b"JPEG", data[:-20] + bytes(20)):
            with self.assertRaises(ValueError):
                png_dimensions(broken)

    def test_native_insets_are_required(self):
        entries = copy.deepcopy(self.entries)
        del entries[-1]["insetsDp"]
        with self.assertRaisesRegex(ValueError, "insets"):
            self.validate(entries)

    def test_pixel_dimensions_are_checked_independently_of_entry_dimensions(self):
        data = png(20, 30)
        (self.output / self.entries[0]["file"]).write_bytes(data)
        self.entries[0]["sha256"] = hashlib.sha256(data).hexdigest()
        with self.assertRaisesRegex(ValueError, "dimensions mismatch"):
            self.validate()

    def test_prepared_identity_uses_frozen_files_without_consulting_main(self):
        name, data = "source.js", b"test\n"
        value = hashlib.sha256(data).hexdigest()
        hashed = hashlib.sha256(name.encode() + b"\0" + value.encode() + b"\n").hexdigest()
        manifest = {"sourceSHA": "frozen-sha", "sourceHash": hashed, "files": {name: value}}
        (self.output / name).write_bytes(b"test\r\n")
        (self.output / ".ui-workspace.json").write_text(json.dumps(manifest))
        with patch("subprocess.check_output", side_effect=AssertionError("Must not read main")):
            self.assertEqual(source_identity(self.output), {"sourceSHA": "frozen-sha", "sourceHash": hashed})
            (self.output / name).write_bytes(b"changed\n")
            with self.assertRaisesRegex(RuntimeError, "Prepared source changed"):
                source_identity(self.output)

    def test_unprepared_capture_is_rejected_without_any_git_fallback(self):
        with patch("subprocess.check_output") as git:
            with self.assertRaisesRegex(RuntimeError, "requires a prepared workspace"):
                source_identity(self.output)
            git.assert_not_called()


class EmulatorSafetyTest(unittest.TestCase):
    def test_real_device_rejected_before_any_mutation(self):
        with tempfile.TemporaryDirectory() as directory, patch("adb.adb_path", return_value="adb"), \
                patch("adb.run", return_value=b"0") as command:
            with self.assertRaisesRegex(RuntimeError, "real devices"):
                Emulator("phone", directory)
            self.assertEqual(command.call_count, 1)
            self.assertEqual(command.call_args.args[0][-2:], ["getprop", "ro.kernel.qemu"])

    def test_failed_capture_restores_existing_overrides_and_all_animation_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            device = object.__new__(Emulator)
            device.command, device.output = ["adb", "-s", "emulator-5554"], Path(directory)
            before = {("wm", "size"): "Physical size: 1080x2400\nOverride size: 800x1100",
                      ("wm", "density"): "Physical density: 420\nOverride density: 200"}
            before.update({("settings", "get", "global", key): value
                           for key, value in zip(ANIMATIONS, (".5", "null", "2"))})
            with patch.object(device, "shell", side_effect=lambda *args: before.get(args, "")) as shell, \
                 patch("adb.run", return_value=b"") as command:
                with self.assertRaisesRegex(RuntimeError, "capture failed"):
                    with device.configured(12345):
                        raise RuntimeError("capture failed")
                for args in (("wm", "size", "800x1100"), ("wm", "density", "200"),
                             ("settings", "put", "global", ANIMATIONS[0], ".5"),
                             ("settings", "delete", "global", ANIMATIONS[1]),
                             ("settings", "put", "global", ANIMATIONS[2], "2")):
                    shell.assert_any_call(*args)
                command.assert_any_call([*device.command, "reverse", "--remove", "tcp:12345"])
                self.assertFalse(any("kill-server" in str(call) for call in command.call_args_list))

    def test_window_insets_and_foreground_are_measured(self):
        dump = (f"mCurrentFocus=Window{{123 {PACKAGE}/Main}}\n"
                "InsetsSource id=1 type=statusBars frame=[0,0][390,24] visible=true\n"
                "InsetsSource id=2 type=navigationBars frame=[0,876][390,900] visible=true")
        metrics = window_metrics(dump, 390, 900)
        self.assertEqual(metrics["insetsDp"], {"left": 0, "top": 24, "right": 0, "bottom": 24})
        self.assertEqual(metrics["contentDp"], {"width": 390, "height": 852})
        with self.assertRaisesRegex(AssertionError, "foreground"):
            window_metrics(dump.replace(PACKAGE, "launcher"), 390, 900)


class InteractionEvidenceTest(unittest.TestCase):
    def test_all_formats_and_actual_process_death_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            form = {"foldResize": True, "systemProcessDeath": True, "originalRestored": True, "realAPI": True,
                    "inputRestored": 13, "newerServerValueProtected": 14}
            path = output / "native-form-lifecycle.json"
            path.write_text(json.dumps(form))
            for format_ in MATRIX["formats"]:
                (output / f"native-swipe-{format_['name']}.json").write_text(json.dumps({"format": format_["name"], "realHorizontalGesture": True}))
            self.assertEqual(len(validate_interactions(output)["horizontalGestures"]), 3)
            path.write_text(json.dumps({**form, "systemProcessDeath": False}))
            with self.assertRaisesRegex(ValueError, "lifecycle"):
                validate_interactions(output)
            path.write_text(json.dumps(form))
            (output / "native-swipe-wide.json").unlink()
            with self.assertRaises(OSError):
                validate_interactions(output)


if __name__ == "__main__":
    unittest.main()
