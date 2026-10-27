"""Runtime probes fail closed; tests never launch browsers, ADB or network services."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.dev import doctor
from scripts.dev.common import UIError, read_json
from scripts.dev.dependencies import environment
from scripts.dev.windows import probe


class DoctorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "go.mod").write_text("module test\ngo 1.27.1\n")
        self.config = {"node": "/node", "node_version": "20.20.2", "go": "/go", "pg_bin": "/pg",
                       "node_modules": str(self.root / "modules"), "playwright_cache": str(self.root / "browsers")}
        entry = self.root / "browsers/chromium_headless_shell-1243/linux/chrome-headless-shell"
        entry.parent.mkdir(parents=True)
        entry.touch()

    def capture(self, command, **kwargs):
        if command[0] == "/node":
            if command[1] == "--version":
                return "v20.20.2"
            return '{"version":"153","executable":"fixture"}'
        if command[0] == "/go":
            return "go version go1.27.1 linux/amd64"
        if command[0] == "ldd":
            return "libraries available"
        return "PostgreSQL 16.15"

    def invoke(self, capture=None, android=None):
        from contextlib import ExitStack
        with ExitStack() as stack:
            stack.enter_context(patch("scripts.dev.doctor.environment", return_value={}))
            stack.enter_context(patch("scripts.dev.doctor.capture", side_effect=capture or self.capture))
            stack.enter_context(patch("scripts.dev.doctor.check_packages", return_value="1.63.0"))
            stack.enter_context(patch("scripts.dev.doctor.read_json", return_value={"browsers": [
                {"name": "chromium-headless-shell", "revision": "1243"}]}))
            stack.enter_context(patch("scripts.dev.windows.probe", side_effect=android,
                                      return_value={"serial": "emulator-1234"}))
            return doctor.inspect(self.root, self.config, self.root)

    def test_checks_repeat_and_include_actual_browser_launch(self):
        calls = []
        def capture(command, **kwargs):
            calls.append(command)
            return self.capture(command, **kwargs)
        self.invoke(capture)
        self.invoke(capture)
        launches = [command for command in calls if "--input-type=module" in command and "chromium.launch" in command[-1]]
        self.assertEqual(len(launches), 2)
        self.assertIn("chromium.launch", launches[0][-1])
        self.assertIn("executablePath", launches[0][-1])

    def test_wrong_version_and_browser_failure_are_not_passed(self):
        def capture(command, **kwargs):
            if command[0] == "/node":
                if command[1] == "--version":
                    return "v22.0.0"
                if "chromium.launch" in command[-1]:
                    raise UIError("browser launch failed")
            return self.capture(command, **kwargs)
        with self.assertRaisesRegex(UIError, "Doctor failed"):
            self.invoke(capture)
        result = read_json(self.root / "doctor.json")
        self.assertEqual(result["status"], "failed")
        self.assertEqual([c["name"] for c in result["checks"] if c["status"] == "failed"],
                         ["node", "playwright-chromium"])

    def test_emulator_failure_remains_failure_in_json(self):
        with self.assertRaises(UIError):
            self.invoke(android=UIError("not an emulator"))
        self.assertEqual(read_json(self.root / "doctor.json")["checks"][-1]["status"], "failed")

    def test_sdk_37_decimal_and_phone_is_never_targeted(self):
        native = self.root / "native/androidApp"
        native.mkdir(parents=True)
        (native / "build.gradle.kts").write_text("compileSdk = 37")
        platform = self.root / "sdk/platforms/android-37.0"
        platform.mkdir(parents=True)
        (platform / "source.properties").write_text("AndroidVersion.ApiLevel=37.0\n")
        (platform / "android.jar").touch()
        calls = []
        def capture(command, **kwargs):
            calls.append(list(map(str, command)))
            if command[-1] == "devices":
                return "phone device\nemulator-1234 device\n"
            if "getprop" in command:
                return "1"
            return 'openjdk version "25.0.3"'
        def convert(value):
            return self.root / ("sdk" if value == "sdk" else "java")
        with patch("scripts.dev.windows.linux_path", side_effect=convert), \
                patch("scripts.dev.windows.capture", side_effect=capture), \
                patch("scripts.dev.windows.runtime_health", return_value={"headless": True}):
            result = probe({"android_home": "sdk", "java_home": "java"}, self.root)
        self.assertEqual(result["serial"], "emulator-1234")
        for command in calls:
            self.assertNotIn("phone", command)
            self.assertNotIn("kill-server", command)

    def test_environment_drops_credentials_and_external_test_urls(self):
        config = {"node": "/node/bin/node", "go": "/go/bin/go", "pg_bin": "/pg/bin",
                  "library_paths": ["/on-c/libs"], "playwright_cache": "/on-c/chromium",
                  "go_path": "/on-c/gopath", "go_cache": "/on-c/gocache"}
        with patch.dict("os.environ", {"DNDSHARE_TEST_DSN": "production", "AWS_SECRET_ACCESS_KEY": "secret",
                                      "DNDSHARE_SMOKE_URL": "https://production", "PATH": "/foreign"}):
            env = environment(config)
        self.assertNotIn("DNDSHARE_TEST_DSN", env)
        self.assertNotIn("AWS_SECRET_ACCESS_KEY", env)
        self.assertNotIn("DNDSHARE_SMOKE_URL", env)
        self.assertNotIn("/foreign", env["PATH"])
        self.assertNotIn("/tmp/", env["LD_LIBRARY_PATH"])

    def test_webunit_probes_do_not_require_postgres_browser_or_android(self):
        with patch("scripts.dev.doctor.environment", return_value={}), \
                patch("scripts.dev.doctor.capture", side_effect=self.capture) as capture, \
                patch("scripts.dev.doctor.check_packages", return_value="1.63.0"), \
                patch("scripts.dev.windows.probe", side_effect=AssertionError("Android must not run")):
            result = doctor.inspect(self.root, self.config, self.root, capabilities={"node", "dependencies"})
        self.assertEqual([check["name"] for check in result["checks"]], ["node", "dependencies"])
        self.assertTrue(all(command.args[0][0] == "/node" for command in capture.call_args_list))
