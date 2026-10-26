#!/usr/bin/env python3
"""Opt-in Android UI smoke, called by TestNativeClientSmokePostgres."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = "ru.dndshare.client.smoke"
COMPONENT = PACKAGE + "/ru.dndshare.client.MainActivity"


def run(args, **kwargs):
    return subprocess.run(list(map(str, args)), check=True, capture_output=True, **kwargs).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    user = os.environ.get("DNDSHARE_WINDOWS_USER", "wrz2")
    sdk = Path(f"/mnt/c/Users/{user}/AppData/Local/Android/Sdk")
    adb = [sdk / "platform-tools/adb.exe", "-s", os.environ.get("DNDSHARE_ANDROID_SERIAL", "emulator-5554")]
    output = ROOT / "build/native-smoke"
    output.mkdir(parents=True, exist_ok=True)

    def shell(*command):
        return run([*adb, "shell", *command]).decode("utf-8", errors="replace").strip()

    def control(path):
        with urllib.request.urlopen(args.url + "/__test/" + path, timeout=10) as response:
            return response.read()

    def tree():
        shell("uiautomator", "dump", "--compressed", "/sdcard/dndshare-smoke.xml")
        xml = run([*adb, "exec-out", "cat", "/sdcard/dndshare-smoke.xml"])
        (output / "latest-ui.xml").write_bytes(xml)
        return ET.fromstring(xml)

    def texts(root):
        return [n.get("text", "") for n in root.iter("node")]

    def wait_for(text, timeout=55):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                root = tree()
                if any(text in value for value in texts(root)):
                    return root
            except (subprocess.CalledProcessError, ET.ParseError):
                pass
            time.sleep(1)
        raise AssertionError(f"UI did not show {text!r}; see {output / 'latest-ui.xml'}")

    def tap(node):
        left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds", "")))
        shell("input", "tap", str((left + right) // 2), str((top + bottom) // 2))

    def click(text):
        root = wait_for(text)
        matches = [n for n in root.iter("node") if n.get("text") == text]
        assert matches, f"No exact text {text!r}"
        tap(matches[-1])

    def snapshot(name):
        shell("screencap", "-p", "/sdcard/dndshare-smoke.png")
        (output / f"{name}.png").write_bytes(run([*adb, "exec-out", "cat", "/sdcard/dndshare-smoke.png"]))
        (output / f"{name}.xml").write_bytes(ET.tostring(tree(), encoding="utf-8"))

    def start():
        shell("am", "start", "-W", "-n", COMPONENT)

    port = args.url.rsplit(":", 1)[1]
    # adb reverse avoids depending on Windows -> WSL localhost forwarding
    # through the emulator's virtual router.
    run([*adb, "reverse", "tcp:" + port, "tcp:" + port])
    android_url = args.url
    windows_root = run(["wslpath", "-w", ROOT]).decode().strip()
    print("Building isolated Android smoke APK", flush=True)
    build = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                            windows_root + "\\scripts\\native\\build.ps1", "-Target", "Android", "-ApiBaseUrl", android_url],
                           stdout=(output / "build.log").open("wb"), stderr=subprocess.STDOUT)
    assert build.returncode == 0, f"APK build failed: {output / 'build.log'}"
    run([*adb, "install", "-r", windows_root + "\\native\\androidApp\\build\\outputs\\apk\\debug\\androidApp-debug.apk"])
    shell("pm", "clear", PACKAGE)
    try:
        shell("wm", "density", "160")
        shell("wm", "size", "420x900")
        shell("input", "keyevent", "82")
        start()
        root = wait_for("Логин")
        edits = [n for n in root.iter("node") if n.get("class") == "android.widget.EditText"]
        assert len(edits) == 2
        tap(edits[0])
        shell("input", "text", "native_tester")
        root = tree()
        tap([n for n in root.iter("node") if n.get("class") == "android.widget.EditText"][1])
        shell("input", "text", "Native-pass-42")
        shell("input", "keyevent", "4")
        click("Войти")
        wait_for("Обновлено")
        root = wait_for("205")
        assert "Native Flame" in texts(root)
        assert json.loads(control("stats"))["images"] == 0, "Handbook prefetched an image"
        snapshot("phone-catalogue")
        click("Native Flame")
        wait_for("Это описание из локальной базы.")
        deadline = time.monotonic() + 20
        while json.loads(control("stats"))["images"] == 0 and time.monotonic() < deadline:
            time.sleep(1)
        assert json.loads(control("stats"))["images"] == 1, "Detail did not request its image once"
        snapshot("phone-detail")
        click("Персонажи")
        wait_for("Лира")
        wait_for("Уровень 7")
        snapshot("phone-characters")
        click("Справочник")
        wait_for("Это описание из локальной базы.")
        control("offline?value=true")
        shell("am", "force-stop", PACKAGE)
        start()
        wait_for("Native Flame")
        click("Native Flame")
        wait_for("Это описание из локальной базы.")
        snapshot("offline-detail")
        for name, size in [("tablet", "800x1100"), ("wide", "1440x1000")]:
            shell("wm", "size", size)
            root = wait_for("Это описание из локальной базы.")
            assert "Поиск по справочнику" in texts(root), "Two panes did not preserve list and detail"
            snapshot(name)
        control("offline?value=false")
        control("change")
        root = tree()
        refresh = [n for n in root.iter("node") if n.get("content-desc") == "Обновить"]
        assert refresh
        tap(refresh[0])
        wait_for("Native Flame Updated")
        root = wait_for("204")
        assert "Native Retired" not in texts(root)
        snapshot("delta-updated")
        account = [n for n in root.iter("node") if n.get("content-desc") == "Аккаунт"]
        assert account
        tap(account[0])
        click("Выйти")
        wait_for("Логин")
        assert not shell("run-as", PACKAGE, "find", "files/native", "-name", "catalogue.db"), "Logout retained the account database"
        print("PASS: real login, 205-item bootstrap, lazy image, characters, tab state, offline restart, three layouts, delta and logout cleanup", flush=True)
    finally:
        control("offline?value=false")
        shell("am", "force-stop", PACKAGE)
        shell("wm", "size", "reset")
        shell("wm", "density", "reset")
        run([*adb, "reverse", "--remove", "tcp:" + port])


if __name__ == "__main__":
    main()
