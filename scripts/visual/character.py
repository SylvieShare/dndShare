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
    named = [node for node in fields if node.get("content-desc") == "Основное значение"]
    fields = named or fields[:1]
    if not fields or expected is not None and fields[0].get("text") != str(expected):
        raise AssertionError(f"Expected one restored stat input {expected!r}; see {device.output}")
    return fields[0]


def set_stat_input(device, value):
    field = input_value(device)
    device.tap(field)
    device.shell("input", "keyevent", "123")
    for _ in range(len(field.get("text", "")) + 2):
        device.shell("input", "keyevent", "67")
    if str(value): device.shell("input", "text", str(value))
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
        row = next(n for n in device.wait("Оружие").iter("node") if n.get("text") == "Оружие")
        tab_left, _, _, bottom = map(int, re.findall(r"\d+", row.get("bounds", "")))
        left, right, y = tab_left + 16, tab_left + 16 + int(width * .25), bottom + 100
        expected = "ЯЧЕЙКИ ЗАКЛИНАНИЙ"
    else:
        left, right, y = int(width * .15), int(width * .85), int(height * .65)
        expected = "СИЛА"
    device.shell("input", "swipe", str(right), str(y), str(left), str(y), "450")
    device.wait(expected)
    if format_["name"] == "wide":
        device.shell("input", "swipe", str(left), str(y), str(right), str(y), "450")
        device.wait("СИЛА" if format_["name"] == "phone" else "ОРУЖИЕ")
    else:
        device.shell("input", "swipe", str(left), str(y), str(right), str(y), "450")
        device.wait("Волшебник 4")
        device.shell("input", "swipe", str(right), str(y), str(left), str(y), "450")
        device.wait("СИЛА")
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

    def wait_server(value):
        deadline = time.monotonic() + 30
        while request(path)["data"]["values"]["STR"]["value"]["base"] != value:
            if time.monotonic() > deadline: raise AssertionError("Live stat input did not reach the server")
            time.sleep(.2)

    set_stat_input(device, base + 1)
    wait_server(base + 1)
    if any(n.get("text") in ("Сохранить", "Отмена") for n in device.tree().iter("node")):
        raise AssertionError("A live morph must not require explicit save/cancel")
    device.shell("wm", "size", "834x1100")
    input_value(device, base + 1)
    set_stat_input(device, "")
    old_pid = device.shell("pidof", PACKAGE)
    device.shell("input", "keyevent", "3")
    device.tree()
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
    input_value(device, "")
    if device.shell("pidof", PACKAGE) == old_pid: raise AssertionError("Restoration must start a new process")
    deadline = time.monotonic() + 25
    while stats().get("requests", {}).get(path, 0) <= reads:
        if time.monotonic() > deadline: raise AssertionError("Restored sheet did not read the server")
        time.sleep(.2)
    set_stat_input(device, base + 3)
    device.wait("Этот показатель изменился")
    if request(path)["data"]["values"]["STR"]["value"]["base"] != base + 2:
        raise AssertionError("Restored draft overwrote a newer server value")
    device.shell("input", "keyevent", "4")
    wait_absent(device, "Основное значение")
    status = next(n for n in device.tree().iter("node") if n.get("content-desc", "").startswith("Изменения остались в черновике"))
    device.tap(status)
    device.click(text="Версия сервера")
    device.click(text="Загрузить")
    deadline = time.monotonic() + 25
    while any(n.get("text") == "Загрузить серверную версию?" for n in device.tree().iter("node")):
        if time.monotonic() > deadline: raise AssertionError("Server reload did not finish")
        time.sleep(.2)
    current = request(path)
    request(path + "/data", {"baseVersion": current["version"], "mutationId": str(uuid.uuid4()),
        "patches": [{"op":"set","path":[key],"value":value} for key,value in original["data"].items()]}, "PATCH")
    device.shell("wm", "size", "390x900")
    device.wait(description="К списку персонажей")
    device.wait("СИЛА")
    if request(path)["data"] != original["data"]: raise AssertionError("Lifecycle smoke did not restore original data")
    return {"autosaveWithoutButtons": True, "foldResize": True, "systemProcessDeath": True,
        "invalidDraftRestored": True, "newerServerValueProtected": base + 2, "originalRestored": True, "realAPI": True}


def verify_vtm_menu(device):
    from native_controls import NativeControls
    controls = NativeControls(device)
    controls.click('Меню персонажа', True)
    controls.find('Сохранить PDF')
    device.click(text='Закрыть')
    device.wait('Тореадор')
    return {'realCompose': True, 'menuReachable': True, 'pdfActionReachable': True}
