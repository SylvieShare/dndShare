"""Small emulator-only ADB interface. Never restarts the shared ADB server."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "ru.dndshare.client.smoke"
COMPONENT = PACKAGE + "/ru.dndshare.client.MainActivity"
ANIMATIONS = ("window_animation_scale", "transition_animation_scale", "animator_duration_scale")


def run(command, **kwargs):
    result = subprocess.run(list(map(str, command)), capture_output=True, timeout=120, **kwargs)
    if result.returncode:
        raise RuntimeError(f"Command failed: {command}: {result.stderr.decode(errors='replace')}")
    return result.stdout


def native_path(path):
    return run(["wslpath", "-w", Path(path).resolve()]).decode().strip()


def powershell_path():
    return (os.environ.get("DNDSHARE_POWERSHELL") or shutil.which("powershell.exe") or
            "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe")


def adb_path():
    if os.environ.get("DNDSHARE_ADB"):
        return os.environ["DNDSHARE_ADB"]
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if sdk and re.match(r"^[A-Za-z]:", sdk):
        sdk = run(["wslpath", "-u", sdk]).decode().strip()
    if not sdk:
        user = os.environ.get("DNDSHARE_WINDOWS_USER", "wrz2")
        sdk = f"/mnt/c/Users/{user}/AppData/Local/Android/Sdk"
    return str(Path(sdk) / "platform-tools/adb.exe")


class Emulator:
    def __init__(self, serial, output):
        self.command = [adb_path(), "-s", serial]
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        if self.shell("getprop", "ro.kernel.qemu") != "1":
            raise RuntimeError("Visual capture requires ro.kernel.qemu=1; real devices are forbidden")

    def shell(self, *command):
        return run([*self.command, "shell", *command]).decode(errors="replace").strip()

    def tree(self):
        self.shell("uiautomator", "dump", "--compressed", "/sdcard/dndshare-ui-review.xml")
        xml = run([*self.command, "exec-out", "cat", "/sdcard/dndshare-ui-review.xml"])
        (self.output / "latest-ui.xml").write_bytes(xml)
        return ET.fromstring(xml)

    def wait(self, text=None, description=None, timeout=70):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                root = self.tree()
                if any((text is None or text in n.get("text", "")) and
                       (description is None or n.get("content-desc") == description)
                       for n in root.iter("node")):
                    return root
            except (RuntimeError, ET.ParseError):
                pass
            time.sleep(.3)
        raise AssertionError(f"Android did not show {text or description!r}; see {self.output}")

    def tap(self, node):
        left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds", "")))
        self.shell("input", "tap", str((left + right) // 2), str((top + bottom) // 2))

    def click(self, text=None, description=None):
        root = self.wait(text, description)
        nodes = [n for n in root.iter("node") if
                 (text is None or n.get("text") == text) and
                 (description is None or n.get("content-desc") == description)]
        if not nodes:
            raise AssertionError(f"Missing exact Android control {text or description!r}")
        self.tap(nodes[-1])

    def pixels(self):
        return run([*self.command, "exec-out", "screencap", "-p"])

    @contextmanager
    def configured(self, port):
        original = {key: self.shell("wm", key) for key in ("size", "density")}
        scales = {key: self.shell("settings", "get", "global", key) for key in ANIMATIONS}
        mappings = run([*self.command, "reverse", "--list"]).decode()
        if f"tcp:{port} " in mappings:
            raise RuntimeError("Review port already has an ADB reverse mapping")
        before = {"wm": original, "animations": scales}
        (self.output / "device-before.json").write_text(json.dumps(before, indent=2))
        try:
            run([*self.command, "reverse", f"tcp:{port}", f"tcp:{port}"])
            for key in ANIMATIONS:
                self.shell("settings", "put", "global", key, "0")
            self.shell("input", "keyevent", "224")
            self.shell("wm", "dismiss-keyguard")
            yield
        finally:
            errors = []
            actions = [("am", "force-stop", PACKAGE)]
            for key, value in original.items():
                match = re.search(r"Override \w+:\s*([\dx]+)", value)
                actions.append(("wm", key, match.group(1) if match else "reset"))
            for key, value in scales.items():
                actions.append(("settings", "delete", "global", key) if value == "null" else
                               ("settings", "put", "global", key, value))
            for command in actions:
                try:
                    self.shell(*command)
                except RuntimeError as error:
                    errors.append(str(error))
            try:
                run([*self.command, "reverse", "--remove", f"tcp:{port}"])
            except RuntimeError as error:
                errors.append(str(error))
            after = {"wm": {key: self.shell("wm", key) for key in original},
                     "animations": {key: self.shell("settings", "get", "global", key) for key in scales}}
            (self.output / "device-after.json").write_text(json.dumps(after, indent=2))
            if after != before:
                errors.append("AVD size/density/animations differ after restoration")
            if errors:
                raise RuntimeError("Emulator restoration failed: " + "; ".join(errors))
