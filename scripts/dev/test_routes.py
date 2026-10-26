"""Command routes and safety boundaries, with Windows/process calls stubbed."""
from argparse import Namespace
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.dev.cli import parser
from scripts.dev.common import UIError
from scripts.dev.plan import make_plan
from scripts.dev.runner import Run, lock, ports, run_plan
from scripts.dev.windows import native_command, select_emulator


class RoutesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = {"node": "/installed/node/bin/node", "go": "/installed/go/bin/go", "powershell": "powershell.exe"}

    def arguments(self, *argv):
        args = parser().parse_args(list(argv) + ["--workspace", str(self.root)])
        args.visual_args = []
        args.report_dir = self.root / "reports"
        return args

    def plan(self, args):
        with patch("scripts.dev.plan.native_command", return_value=["native-stub"]):
            return make_plan(args, self.config, self.root, "emulator-1234", 11111)

    def test_explicit_focus_is_required(self):
        with patch("sys.stderr"):
            with self.assertRaises(SystemExit):
                self.arguments("focus")
            with self.assertRaises(SystemExit):
                parser().parse_args(["focus", "webunit"])

    def test_unit_browser_native_routes(self):
        unit = self.plan(self.arguments("focus", "webunit"))
        self.assertEqual([stage.name for stage in unit], ["webunit"])
        self.assertIn("--no-cache", unit[0].command)
        browser = self.plan(self.arguments("focus", "browser", "--project", "maps"))
        self.assertIn("--project=maps", browser[0].command)
        native = self.plan(self.arguments("focus", "native", "--target", "DeviceTest"))
        self.assertTrue(native[0].native)
        self.assertEqual(native[0].name, "nativeDeviceTest")

    def test_files_must_exist_inside_test_root(self):
        for value in ("../secrets", "/tmp/anything", "src/missing.test.js"):
            with self.subTest(value=value), self.assertRaises(UIError):
                self.plan(self.arguments("focus", "webunit", "--file", value))
        test = self.root / "frontend/src/example.test.js"
        test.parent.mkdir(parents=True)
        test.write_text("fixture")
        selected = self.plan(self.arguments("focus", "webunit", "--file", "src/example.test.js"))
        self.assertEqual([stage.name for stage in selected], ["bindings", "webunit"])

    def test_verify_matrix_and_optional_backend(self):
        for name in ("scripts/native/sync_web_design.py", "scripts/design/tokens.py", "scripts/design/fonts.py"):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        names = [stage.name for stage in self.plan(self.arguments("verify", "--tag", "backend"))]
        self.assertEqual(names, ["webunit", "webbuild", "browser", "nativeAll", "nativeDeviceTest",
                                 "palette-icons", "tokens", "fonts", "wiki", "go-test", "go-vet", "go-build"])
        self.assertNotIn("go-test", [stage.name for stage in self.plan(self.arguments("verify"))])
        (self.root / "scripts/design/fonts.py").unlink()
        self.assertNotIn("fonts", [stage.name for stage in self.plan(self.arguments("verify"))])

    def test_review_missing_fails_and_arguments_are_forwarded(self):
        args = self.arguments("review")
        with self.assertRaisesRegex(UIError, "Visual runner"):
            self.plan(args)
        script = self.root / "scripts/visual/compare.py"
        script.parent.mkdir(parents=True)
        script.touch()
        args.visual_args = ["--scenario", "navigation"]
        result = self.plan(args)
        self.assertEqual(result[0].cwd, self.root)
        self.assertEqual(result[0].command[-2:], args.visual_args)

    def test_phone_never_selected(self):
        devices = "List of devices attached\nphone123 device\nemulator-1234 device\n"
        self.assertEqual(select_emulator(devices), "emulator-1234")
        for value in ("phone123", "emulator-5555"):
            with self.assertRaises(UIError):
                select_emulator(devices, value)
        with self.assertRaises(UIError):
            select_emulator(devices + "emulator-5678 device\n")
        with self.assertRaises(UIError):
            native_command(self.config, self.root, "DeviceTest", "phone123", 11111)

    def test_ports_are_unique_and_workspace_lock_is_exclusive(self):
        self.assertEqual(len(set(ports(8))), 8)
        with lock(self.root / "lock"):
            with self.assertRaisesRegex(UIError, "Another UI run"):
                with lock(self.root / "lock"):
                    self.fail("acquired twice")

    def test_failed_stages_continue_and_receipts_never_reuse_pass(self):
        from scripts.dev.plan import Stage
        manifest = {"sourceSHA": "sha", "sourceHash": "hash", "hotCache": str(self.root / "hot")}
        run = Run(self.root, "verify")
        run.receipt["emulator"] = "emulator-1234"
        stages = [Stage("one", ["stub"], self.root), Stage("two", ["stub"], self.root)]
        with patch("scripts.dev.runner.environment", return_value={}), \
                patch("scripts.dev.runner.execute", side_effect=[2, 0]):
            run_plan(run, stages, {}, self.root, manifest, [11111, 22222, 33333], 1)
        self.assertEqual(run.finish(), 1)
        self.assertEqual([stage["status"] for stage in run.receipt["stages"]], ["failed", "passed"])
        again = Run(self.root, "verify")
        self.assertNotEqual(run.directory, again.directory)
        self.assertEqual(again.receipt["status"], "running")
        self.assertEqual(again.receipt["stages"], [])

    def test_each_cli_invocation_rechecks_doctor_and_records_failure(self):
        from scripts.dev.cli import main
        from scripts.dev.common import read_json
        commands = [["doctor"], ["prepare"], ["focus", "webunit"], ["verify"], ["review"]]
        with patch("scripts.dev.cli.config.load", return_value={}), \
                patch("scripts.dev.cli.doctor.inspect", side_effect=UIError("fixture doctor failure")) as inspect:
            for command in commands:
                args = command if command[0] in {"doctor", "prepare"} else command + ["--workspace", str(self.root)]
                self.assertEqual(main(args, self.root), 1)
        self.assertEqual(inspect.call_count, 5)
        receipts = list((self.root / "build/ui-runs").glob("*/receipt.json"))
        self.assertEqual(len(receipts), 5)
        for file in receipts:
            receipt = read_json(file)
            self.assertEqual(receipt["status"], "failed")
            self.assertEqual(receipt["stages"], [])

    def test_review_cannot_override_runner_device_or_report_directory(self):
        script = self.root / "scripts/visual/compare.py"
        script.parent.mkdir(parents=True)
        script.touch()
        for values in (["--serial", "phone"], ["--output=/old/reports"]):
            args = self.arguments("review")
            args.visual_args = values
            with self.assertRaisesRegex(UIError, "review owns"):
                self.plan(args)

    def test_capabilities_follow_job_and_only_device_tests_require_running_emulator(self):
        from scripts.dev.cli import capabilities
        self.assertEqual(capabilities(self.arguments("focus", "webunit")), ({"node", "dependencies"}, False))
        self.assertEqual(capabilities(self.arguments("focus", "browser")),
                         ({"node", "dependencies", "playwright-chromium"}, False))
        self.assertEqual(capabilities(self.arguments("focus", "native")), ({"android"}, False))
        self.assertEqual(capabilities(self.arguments("focus", "native", "--target", "DeviceTest")), ({"android"}, True))
        self.assertEqual(capabilities(self.arguments("verify")), (None, True))
