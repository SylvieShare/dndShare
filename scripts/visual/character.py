"""Black-box native sheet gestures and system process-death restoration, on fake data."""
import http.cookiejar
import json
import re
import time
import urllib.request
import uuid
import xml.etree.ElementTree as ET

from adb import COMPONENT, PACKAGE


def input_value(device, expected=None):
    root = device.wait("Основное значение")
    fields = [node for node in root.iter("node") if node.get("class") == "android.widget.EditText"]
    if len(fields) != 1 or expected is not None and fields[0].get("text") != str(expected):
        raise AssertionError(f"Expected one restored stat input {expected!r}; see {device.output}")
    return fields[0]


def set_stat_input(device, value):
    field = input_value(device)
    device.tap(field)
    device.shell("input", "keyevent", "123")
    for _ in range(len(field.get("text", "")) + 2):
        device.shell("input", "keyevent", "67")
    device.shell("input", "text", str(value))
    device.shell("input", "keyevent", "4")
    input_value(device, value)


def wait_absent(device, text):
    deadline = time.monotonic() + 35
    while any(text in node.get("text", "") for node in device.tree().iter("node")):
        if time.monotonic() > deadline:
            raise AssertionError(f"Native sheet did not close {text!r}")
        time.sleep(.2)


def verify_swipes(device, format_):
    width, height = format_["width"], format_["height"]
    if format_["name"] == "wide":
        row = next(n for n in device.wait("Учебный посох").iter("node") if n.get("text") == "Учебный посох")
        _, top, _, bottom = map(int, re.findall(r"\d+", row.get("bounds", "")))
        left, right, y = int(width * .35), int(width * .60), (top + bottom) // 2
        expected = "Ячейки заклинаний"
    else:
        left, right, y = int(width * .15), int(width * .85), int(height * .65)
        expected = "СИЛА" if format_["name"] == "tablet" else "Учебный посох"
    device.shell("input", "swipe", str(right), str(y), str(left), str(y), "450")
    device.wait(expected)
    if format_["name"] != "tablet":
        device.shell("input", "swipe", str(left), str(y), str(right), str(y), "450")
        device.wait("СИЛА" if format_["name"] == "phone" else "Учебный посох")
    return {"format": format_["name"], "realHorizontalGesture": True, "forwardContent": expected}


def verify_form_restoration(device, url, fixture, stats):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, data=None, method=None):
        req = urllib.request.Request(url + path, data=json.dumps(data).encode() if data is not None else None,
            method=method, headers={"Content-Type": "application/json"})
        with opener.open(req, timeout=20) as response:
            return json.load(response)

    request("/api/user/auth", {key: fixture[key] for key in ("login", "password")})
    path = "/api/char/" + fixture["characters"][0]["uuid"]
    original = request(path)
    base = original["data"]["values"]["STR"]["value"]["base"]

    def change_base(value):
        current = request(path)
        request(path + "/data", {"baseVersion": current["version"], "mutationId": str(uuid.uuid4()),
            "patches": [{"op": "set", "path": ["values", "STR", "value", "base"], "value": value}]}, "PATCH")

    set_stat_input(device, base + 1)
    device.shell("wm", "size", "834x1100")
    input_value(device, base + 1)
    old_pid = device.shell("pidof", PACKAGE)
    device.shell("input", "keyevent", "3")
    device.tree()  # Wait for the launcher and Activity.onStop to save Android state.
    device.shell("am", "kill", PACKAGE)
    deadline = time.monotonic() + 25
    while True:
        try: alive = device.shell("pidof", PACKAGE)
        except RuntimeError: alive = ""
        if not alive: break
        if time.monotonic() > deadline: raise AssertionError("Background test process was not killed")
        time.sleep(.2)
    change_base(base + 2)
    reads = stats().get("requests", {}).get(path, 0)
    device.shell("am", "start", "-W", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER", "-f", "0x10200000", "-n", COMPONENT)
    input_value(device, base + 1)
    if device.shell("pidof", PACKAGE) == old_pid:
        raise AssertionError("Restoration must run in a new Android process")
    deadline = time.monotonic() + 25
    while stats().get("requests", {}).get(path, 0) <= reads:
        if time.monotonic() > deadline: raise AssertionError("Restored sheet did not read the current server document")
        time.sleep(.2)
    input_value(device, base + 1)
    device.click(text="Сохранить")
    device.wait("Этот показатель изменился")
    input_value(device, base + 1)
    if request(path)["data"]["values"]["STR"]["value"]["base"] != base + 2:
        raise AssertionError("Restored form overwrote a newer external change")
    device.click(text="Отмена")
    wait_absent(device, "Основное значение")
    change_base(base)
    device.shell("wm", "size", "390x900")
    # wm returns before Activity recreation and Compose BackHandler registration.
    # Wait for the new phone content before sending Back to the restored activity.
    device.wait(description="Меню персонажа")
    device.wait("СИЛА")
    (device.output / "lifecycle-phone-before-back.xml").write_bytes(ET.tostring(device.tree(), encoding="utf-8"))
    device.shell("input", "keyevent", "4")
    device.wait(fixture["characters"][0]["name"])
    device.click(text=fixture["characters"][0]["name"])
    device.wait("СИЛА")
    if request(path)["data"] != original["data"]:
        raise AssertionError("Lifecycle smoke must restore the exact shared character data")
    return {"foldResize": True, "systemProcessDeath": True, "inputRestored": base + 1,
        "newerServerValueProtected": base + 2, "originalRestored": True, "realAPI": True}
