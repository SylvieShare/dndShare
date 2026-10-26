"""Capture clean native defaults at every logical format, preserving the AVD."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

from adb import COMPONENT, PACKAGE, native_path, powershell_path, run


def build_install(device, root, url, output):
    if not re.match(r"^http://127\.0\.0\.1:\d+$", url):
        raise RuntimeError("APK capture requires the isolated loopback API")
    windows_root = native_path(root)
    if not re.match(r"^[A-Za-z]:\\", windows_root):
        raise RuntimeError("Prepared Android build checkout must be on a Windows drive")
    with (output / "apk-build.log").open("wb") as log:
        subprocess.run([powershell_path(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                        windows_root + "\\scripts\\native\\build.ps1", "-Target", "Android",
                        "-ApiBaseUrl", url], stdout=log, stderr=subprocess.STDOUT, check=True, timeout=900)
    apk = Path(root) / "native/androidApp/build/outputs/apk/debug/androidApp-debug.apk"
    run([*device.command, "install", "-r", native_path(apk)])
    return hashlib.sha256(apk.read_bytes()).hexdigest()


def login(device, fixture):
    device.shell("am", "force-stop", PACKAGE)
    device.shell("pm", "clear", PACKAGE)
    device.shell("am", "start", "-W", "-n", COMPONENT)
    root = device.wait("Логин")
    edits = [n for n in root.iter("node") if n.get("class") == "android.widget.EditText"]
    if len(edits) != 2:
        raise AssertionError("Expected two native login fields")
    for index, value in enumerate((fixture["login"], fixture["password"])):
        device.tap(edits[index])
        device.tree()  # Wait for the IME input connection before injecting keys.
        for character in value:
            device.shell("input", "text", character)
        root = device.tree()
        edits = [n for n in root.iter("node") if n.get("class") == "android.widget.EditText"]
    device.shell("input", "keyevent", "4")
    device.click(text="Войти")
    device.wait("Основные разделы")
    device.wait("205")


def window_metrics(dump, width, height):
    if not re.search(r"mCurrentFocus=Window\{[^\n]*" + re.escape(PACKAGE), dump):
        raise AssertionError("Smoke activity does not own the foreground window")
    sources = []
    pattern = r"InsetsSource id=\S+ type=(\w+) frame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\] visible=(\w+)"
    for kind, left, top, right, bottom, visible in re.findall(pattern, dump):
        entry = {"type": kind, "framePx": list(map(int, (left, top, right, bottom))), "visible": visible == "true"}
        if entry not in sources:
            sources.append(entry)
    if not sources:
        raise AssertionError("Cannot measure native window insets")
    insets = dict(left=0, top=0, right=0, bottom=0)
    for source in sources:
        if not source["visible"] or source["type"] not in ("statusBars", "navigationBars", "displayCutout"):
            continue
        left, top, right, bottom = source["framePx"]
        if left == 0 and right == width:
            if top == 0:
                insets["top"] = max(insets["top"], bottom)
            elif bottom == height:
                insets["bottom"] = max(insets["bottom"], height - top)
        elif top == 0 and bottom == height:
            if left == 0:
                insets["left"] = max(insets["left"], right)
            elif right == width:
                insets["right"] = max(insets["right"], width - left)
    return {"insetsDp": insets, "insetSources": sources,
            "contentDp": {"width": width - insets["left"] - insets["right"],
                          "height": height - insets["top"] - insets["bottom"]}, "densityDpi": 160}


def snapshot(device, output, format_, state, fixture, stats):
    prefix = f"{format_['name']}-{state}"
    tree = device.tree()
    # Wait for actual rendered frames to stop changing; no masks, crops or overlays.
    previous = None
    for _ in range(24):
        pixels = device.pixels()
        if pixels == previous:
            break
        previous = pixels
        time.sleep(.35)
    else:
        raise AssertionError(f"Native frames did not settle: {prefix}")
    image = output / f"{prefix}.png"
    image.write_bytes(pixels)
    (output / f"{prefix}.xml").write_bytes(ET.tostring(tree, encoding="utf-8"))
    dump = device.shell("dumpsys", "window")
    (output / f"{prefix}-window.txt").write_text(dump)
    metrics = window_metrics(dump, format_["width"], format_["height"])
    return {"platform": "android", "format": format_["name"], "state": state,
            "recordID": fixture["recordID"] if state == "record" else None,
            "viewport": {"width": format_["width"], "height": format_["height"], "unit": "dp"},
            "dimensions": {"width": format_["width"], "height": format_["height"], "unit": "px"},
            "file": f"android/{image.name}", "sha256": hashlib.sha256(pixels).hexdigest(),
            "apiStats": stats(), **metrics}


def capture_android(device, root, url, output, matrix, fixture, stats):
    apk_hash = build_install(device, root, url, output.parent)
    entries = []
    for format_ in matrix["formats"]:
        print(f"Capturing ANDROID {format_['name']}", flush=True)
        device.shell("am", "force-stop", PACKAGE)
        device.shell("wm", "density", "160")
        device.shell("wm", "size", f"{format_['width']}x{format_['height']}")
        login(device, fixture)
        entries.append(snapshot(device, output, format_, "collections", fixture, stats))
        if format_["name"] != "wide":
            root_ui = device.tree()
            controls = [n for n in root_ui.iter("node") if n.get("content-desc") in ("Открыть меню", "Раскрыть панель")]
            if not controls:
                raise AssertionError("Missing native menu opener")
            device.tap(controls[0])
        device.wait("ДЛЯ ИГРОКА")
        entries.append(snapshot(device, output, format_, "menu", fixture, stats))
        if format_["name"] != "wide":
            device.shell("input", "keyevent", "4")
        device.click(text="Заклинания")
        device.wait(fixture["recordName"])
        entries.append(snapshot(device, output, format_, "list", fixture, stats))
        before = stats()["images"].get("cover.svg", 0)
        device.click(text=fixture["recordName"])
        device.wait(fixture["description"])
        deadline = time.monotonic() + 30
        while stats()["images"].get("cover.svg", 0) <= before:
            if time.monotonic() > deadline:
                raise AssertionError("Native record did not lazily fetch its cover from the shared API")
            time.sleep(.25)
        entries.append(snapshot(device, output, format_, "record", fixture, stats))
    for entry in entries:
        entry["apkSHA256"] = apk_hash
    (output.parent / "android.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2))
