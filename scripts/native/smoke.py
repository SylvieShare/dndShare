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
from navigation_smoke import NavigationSmoke
from handbook_smoke import HandbookSmoke

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = "ru.dndshare.client.smoke"
COMPONENT = PACKAGE + "/ru.dndshare.client.MainActivity"


def run(args, **kwargs):
    result = subprocess.run(list(map(str, args)), capture_output=True, **kwargs)
    if result.returncode:
        print(result.stderr.decode("utf-8", errors="replace"), flush=True)
        result.check_returncode()
    return result.stdout


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

    assert shell("getprop", "ro.kernel.qemu") == "1", "Smoke requires an emulator; phone data must stay untouched"

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

    def bounds(node):
        return tuple(map(int, re.findall(r"\d+", node.get("bounds", ""))))

    def tap(node):
        left, top, right, bottom = bounds(node)
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

    def start(fresh=False):
        flags = ["-f", "0x10008000"] if fresh else []
        shell("am", "start", "-W", *flags, "-n", COMPONENT)

    navigation = NavigationSmoke(shell, tree, tap, wait_for, snapshot)
    handbook = HandbookSmoke(shell, tree, tap, click, wait_for, snapshot)

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
        shell("input", "keyevent", "224")
        shell("wm", "dismiss-keyguard")
        start(fresh=True)
        root = wait_for("Логин")
        edits = [n for n in root.iter("node") if n.get("class") == "android.widget.EditText"]
        assert len(edits) == 2
        tap(edits[0])
        tree()  # Wait for the IME connection and inset/header animation before injecting hardware keys.
        for character in "native_tester":
            shell("input", "text", character)
        root = tree()
        tap([n for n in root.iter("node") if n.get("class") == "android.widget.EditText"][1])
        tree()  # Switching to a password restarts the IME input connection.
        for character in "Native-pass-42":
            shell("input", "text", character)
        root = tree()
        edits = [n for n in root.iter("node") if n.get("class") == "android.widget.EditText"]
        title = next(n for n in root.iter("node") if n.get("text") == "DnD Share")
        subtitle = next(n for n in root.iter("node") if "Ваши персонажи" in n.get("text", ""))
        assert bounds(title)[0] >= bounds(edits[0])[0] + 60, "Compact title should move beside the icon"
        assert bounds(subtitle)[0] == bounds(title)[0], "Compact subtitle should follow the title"
        assert edits[1].get("focused") == "true", "Header animation lost field focus"
        assert "native_tester" in edits[0].get("text", ""), "Header animation lost the login draft"
        assert len(edits[1].get("text", "")) == len("Native-pass-42"), "IME did not receive the full test password"
        ime = shell("dumpsys", "window")
        frames = re.findall(r"type=ime[^\n]*?frame=\[\d+,(\d+)\]\[\d+,\d+\][^\n]*?visible=true", ime)
        assert frames, "Keyboard should be visible during the layout check"
        keyboard_top = min(map(int, frames))
        button = next(n for n in root.iter("node") if n.get("text") == "Войти")
        assert max(bounds(n)[3] for n in [*edits, button]) <= keyboard_top, "Keyboard covers login controls"
        snapshot("phone-login-keyboard")
        shell("input", "keyevent", "4")
        root = tree()
        title = next(n for n in root.iter("node") if n.get("text") == "DnD Share")
        assert bounds(title)[0] == bounds(edits[0])[0], "Header should expand after hiding the keyboard"
        click("Войти")
        handbook.overview_and_search()
        wait_for("Обновлено")
        root = wait_for("205")
        assert "Native Flame" in texts(root)
        assert json.loads(control("stats"))["images"] == 0, "Handbook prefetched an image"
        start()
        history = shell("dumpsys", "activity", "activities")
        assert sum(bool(re.search(r"\bHist\s+#", line)) and PACKAGE + "/" in line
                   for line in history.splitlines()) == 1, "Relaunch duplicated the activity"
        shell("input", "keyevent", "4")
        wait_for("Основные разделы")
        shell("input", "keyevent", "4")
        time.sleep(0.5)
        focus = next(line for line in shell("dumpsys", "window").splitlines() if "mCurrentFocus=Window{" in line)
        assert PACKAGE not in focus, "Root Back should background the app"
        start()
        root = handbook.enter_collection_if_needed()
        assert "Логин" not in texts(root), "Back returned to the login form after authentication"
        navigation.phone()
        snapshot("phone-catalogue")
        click("Native Flame")
        wait_for("Это описание из локальной базы.")
        deadline = time.monotonic() + 20
        while json.loads(control("stats"))["images"] == 0 and time.monotonic() < deadline:
            time.sleep(1)
        assert json.loads(control("stats"))["images"] == 1, "Detail did not request its image once"
        snapshot("phone-detail")
        navigation.detail_back()
        shell("input", "keyevent", "4")
        root = wait_for("205")
        assert "Это описание из локальной базы." not in texts(root), "Detail Back should return to the list"
        click("Native Flame")
        wait_for("Это описание из локальной базы.")
        navigation.navigate("Персонажи")
        wait_for("Лира")
        wait_for("Уровень 7")
        snapshot("phone-characters")
        navigation.navigate("Справочник")
        wait_for("Это описание из локальной базы.")
        control("offline?value=true")
        shell("am", "force-stop", PACKAGE)
        start()
        handbook.enter_collection_if_needed()
        click("Native Flame")
        wait_for("Это описание из локальной базы.")
        snapshot("offline-detail")
        for name, size in [("tablet", "800x1100"), ("wide", "1440x1000")]:
            shell("wm", "size", size)
            root = wait_for("Это описание из локальной базы.")
            assert "Поиск по справочнику" in texts(root), "Two panes did not preserve list and detail"
            snapshot(name)
            navigation.adaptive(name)
        navigation.transitions()
        control("offline?value=false")
        control("change")
        # Startup must synchronize automatically; the header has no manual refresh action.
        shell("am", "force-stop", PACKAGE)
        start()
        handbook.enter_collection_if_needed()
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
        print("PASS: keyboard layout and draft, real login, root/detail Back, single activity, 205-item bootstrap, lazy image, characters, tab state, offline restart, three layouts, delta and logout cleanup", flush=True)
    finally:
        control("offline?value=false")
        shell("am", "force-stop", PACKAGE)
        shell("wm", "size", "reset")
        shell("wm", "density", "reset")
        run([*adb, "reverse", "--remove", "tcp:" + port])


if __name__ == "__main__":
    main()
