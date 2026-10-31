"""Capture clean native defaults at every logical format, preserving the AVD."""
import hashlib
import http.cookiejar
import urllib.request
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

from adb import COMPONENT, PACKAGE, native_path, powershell_path, run
from character import verify_swipes, verify_form_restoration, wait_absent, verify_vtm_menu


def build_install(device, root, url, output):
    if not re.match(r"^http://127\.0\.0\.1:\d+$", url):
        raise RuntimeError("APK capture requires the isolated loopback API")
    from apk import obtain
    artifact, receipt = obtain(Path(root), output)
    run([*device.command, "install", "-r", native_path(artifact)])
    (output / "apk-artifact.json").write_text(json.dumps(receipt, indent=2))
    return receipt['apkHash']



def login(device, fixture):
    device.shell("am", "force-stop", PACKAGE)
    device.shell("pm", "clear", PACKAGE)
    device.shell("am", "start", "-W", "-n", COMPONENT)
    try:
        root = device.wait("Логин", timeout=20)
    except AssertionError:
        # AVD accessibility can lose the first window after SystemUI restarts.
        # Retry this disposable app's cold start once, never the shared ADB server.
        device.shell("am", "force-stop", PACKAGE)
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
    # Keyboard dismissal also changes the compact brand layout. Wait for the
    # actual button bounds to settle before injecting a coordinate tap.
    previous = None
    for _ in range(8):
        tree = device.tree()
        button = next((n for n in tree.iter("node") if n.get("text") == "Войти"), None)
        if button is not None and button.get("bounds") == previous:
            device.tap(button)
            break
        previous = button.get("bounds") if button is not None else None
    else:
        raise AssertionError("Login button did not settle after keyboard dismissal")
    device.wait("Основные разделы")
    device.wait("205")


def owns_foreground(dump, allow_popup):
    if re.search(r"mCurrentFocus=Window\{[^\n]*" + re.escape(PACKAGE) + r"/", dump):
        return True
    if not allow_popup:
        return False
    focus = re.search(r"mCurrentFocus=Window\{(\S+) ", dump)
    headers = list(re.finditer(r"(?m)^[ \t]*Window #\d+ Window\{(\S+) [^\n]*", dump))
    blocks = {
        header.group(1): dump[header.start():headers[i + 1].start() if i + 1 < len(headers) else len(dump)]
        for i, header in enumerate(headers)
    }
    current = blocks.get(focus.group(1), '') if focus else ''
    owner = re.search(r"mOwnerUid=(\d+)[^\n]* package=(\S+)", current)
    app_uids = set()
    for block in blocks.values():
        if PACKAGE + '/' in block.split('\n', 1)[0]:
            match = re.search(r"mOwnerUid=(\d+)[^\n]* package=" + re.escape(PACKAGE) + r"\b", block)
            if match:
                app_uids.add(match.group(1))
    return bool(owner and owner.group(2) == PACKAGE and owner.group(1) in app_uids
                and re.search(r"mFocusedApp=[^\n]*" + re.escape(PACKAGE) + r"/", dump))


def window_metrics(dump, width, height, allow_popup=False):
    if not owns_foreground(dump, allow_popup):
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
    metrics = window_metrics(dump, format_["width"], format_["height"], allow_popup=state in {'character-menu','sheet-item-view','sheet-weapon-item','sheet-weapon-details'})
    character = fixture["characters"][0] if state.startswith("sheet-") else fixture["characters"][1] if state == "vtm-base" else None
    return {"platform": "android", "format": format_["name"], "state": state,
            "characterUUID": character["uuid"] if character else None,
            "recordID": fixture["recordID"] if state == "record" else None,
            "viewport": {"width": format_["width"], "height": format_["height"], "unit": "dp"},
            "dimensions": {"width": format_["width"], "height": format_["height"], "unit": "px"},
            "file": f"android/{image.name}", "sha256": hashlib.sha256(pixels).hexdigest(),
            "apiStats": stats(), **metrics}


def verify_character_edit(device, url, fixture):
    """Use the real Compose form and API, then restore the shared visual data."""
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path, data=None):
        req = urllib.request.Request(url + path, data=json.dumps(data).encode() if data is not None else None,
                                     headers={"Content-Type": "application/json"})
        with opener.open(req, timeout=20) as response:
            return json.load(response)
    request('/api/user/auth', {key: fixture[key] for key in ('login', 'password')})
    path = '/api/char/' + fixture['characters'][0]['uuid']
    original = request(path)
    initial = original['data']['values']['hp']['current']
    evidence = []
    for expected in (initial - 1, initial):
        device.click(text=str(initial if expected != initial else initial - 1))
        root = device.wait('Текущие хиты')
        edits = [n for n in root.iter('node') if n.get('class') == 'android.widget.EditText']
        if len(edits) != 3:
            raise AssertionError('Native HP editor must show current, temporary and maximum values')
        device.tap(edits[0])
        device.tree()
        device.shell('input', 'keyevent', '123')
        for _ in range(len(edits[0].get('text', '')) + 2):
            device.shell('input', 'keyevent', '67')
        device.shell('input', 'text', str(expected))
        device.shell('input', 'keyevent', '4')
        device.click(text='Сохранить')
        deadline = time.monotonic() + 30
        while True:
            current = request(path)
            if current['data']['values']['hp']['current'] == expected:
                break
            if time.monotonic() > deadline:
                raise AssertionError('Native HP edit did not reach the real versioned API')
            time.sleep(.25)
        evidence.append({'current': expected, 'version': current['version']})
    if current['data'] != original['data'] or current['version'] <= original['version']:
        raise AssertionError('Native edit verification must restore exactly the original character data')
    return {'realComposeForm': True, 'realAPI': True, 'originalRestored': True, 'changes': evidence}


def capture_android(device, root, url, output, matrix, fixture, stats):
    apk_hash = build_install(device, root, url, output.parent)
    entries = []
    login_count = 0
    cover_verified = False
    wanted = set(matrix['states'])
    full = wanted == {'collections', 'menu', 'list', 'record', 'character-list', 'character-menu', 'sheet-base', 'sheet-death-saves', 'sheet-stats', 'sheet-stat-editor', 'sheet-weapons', 'sheet-magic', 'sheet-inventory', 'sheet-personality', 'sheet-item-view', 'sheet-weapon-item', 'sheet-weapon-details', 'vtm-base'}

    def take(format_, state):
        if state in wanted:
            entries.append(snapshot(device, output, format_, state, fixture, stats))

    handbook = bool(wanted & {'collections', 'menu', 'list', 'record'})
    for index, format_ in enumerate(matrix['formats']):
        print(f"Capturing ANDROID {format_['name']}", flush=True)
        device.shell('wm', 'density', '160')
        device.shell('wm', 'size', f"{format_['width']}x{format_['height']}")
        if index == 0:
            login(device, fixture)
            login_count += 1
        elif handbook:
            if format_['name'] != 'wide':
                device.click(description='Открыть меню')
            device.click(text='Справочник')
            device.wait('Основные разделы')
        if handbook:
            take(format_, 'collections')
            if format_['name'] != 'wide':
                device.click(description='Открыть меню')
            device.wait('ДЛЯ ИГРОКА')
            take(format_, 'menu')
            if format_['name'] != 'wide':
                device.shell('input', 'keyevent', '4')
            if wanted & {'list', 'record'}:
                device.click(text='Заклинания')
                device.wait(fixture['recordName'])
                take(format_, 'list')
                if 'record' in wanted:
                    before = stats()['images'].get('cover.svg', 0)
                    device.click(text=fixture['recordName'])
                    device.wait(fixture['description'])
                    deadline = time.monotonic() + 30
                    while not cover_verified and stats()['images'].get('cover.svg', 0) <= before:
                        if time.monotonic() > deadline:
                            raise AssertionError('Native record did not lazily fetch its cover')
                        time.sleep(.25)
                    cover_verified = True
                    take(format_, 'record')
                    device.shell('input', 'keyevent', '4')
                device.shell('input', 'keyevent', '4')
        if not (wanted & {'character-list', 'character-menu', 'sheet-base', 'sheet-death-saves', 'sheet-stats', 'sheet-stat-editor', 'sheet-weapons', 'sheet-magic', 'sheet-inventory', 'sheet-personality', 'sheet-item-view', 'sheet-weapon-item', 'sheet-weapon-details', 'vtm-base'}):
            continue
        if index == 0 or handbook:
            if format_['name'] != 'wide':
                device.click(description='Открыть меню')
            device.click(text='Персонажи')
        take(format_, 'character-list')
        if 'character-menu' in wanted:
            device.click(description='Действия: '+fixture['characters'][0]['name'])
            device.wait('Клонировать')
            take(format_,'character-menu')
            device.shell('input','keyevent','4')
            device.wait('Новый персонаж')
        if wanted & { 'sheet-base', 'sheet-death-saves', 'sheet-stats', 'sheet-stat-editor', 'sheet-weapons', 'sheet-magic', 'sheet-inventory', 'sheet-personality', 'sheet-item-view', 'sheet-weapon-item', 'sheet-weapon-details'}:
            device.click(text=fixture['characters'][0]['name'])
            if format_['name'] == 'phone':
                device.click(description='База')
            elif format_['name'] == 'tablet':
                device.click(text='База')
            device.wait('Волшебник 4' if format_['name'] != 'wide' else fixture['characters'][0]['name'])
            if format_['name']=='wide': device.click(text='Оружие')
            take(format_, 'sheet-base')
            if 'sheet-death-saves' in wanted:
                if format_['name']!='phone': device.wait(description='Успехи: 3')
                take(format_, 'sheet-death-saves')
            if wanted & {'sheet-stats', 'sheet-stat-editor'}:
                if 'sheet-stats' in wanted:
                    gesture = verify_swipes(device, format_)
                    (output.parent / ('native-swipe-' + format_['name'] + '.json')).write_text(json.dumps(gesture, ensure_ascii=False, indent=2))
                elif format_['name'] != 'wide':
                    device.click(description='Статы') if format_['name'] == 'phone' else device.click(text='Статы')
                device.wait('ТЕЛОСЛОЖЕНИЕ')
                take(format_, 'sheet-stats')
            if 'sheet-stat-editor' in wanted:
                device.click(description='Редактировать: Сила')
                device.wait('Основное значение')
                take(format_, 'sheet-stat-editor')
                if full and format_['name'] == 'phone':
                    lifecycle = verify_form_restoration(device, url, fixture, stats)
                    (output.parent / 'native-form-lifecycle.json').write_text(json.dumps(lifecycle, ensure_ascii=False, indent=2))
                else:
                    device.shell('input', 'keyevent', '4')
                    wait_absent(device, 'Основное значение')
            if wanted & {'sheet-weapons','sheet-weapon-item','sheet-weapon-details'}:
                device.click(description='Оружие') if format_['name']=='phone' else device.click(text='Оружие')
                device.wait('Посох молнии')
                take(format_, 'sheet-weapons')
                if wanted & {'sheet-weapon-item','sheet-weapon-details'}:
                    device.click(text='Посох молнии')
                    device.wait('Удалить')
                    device.click(text='Справочник')
                    device.wait(description='Закрыть просмотр')
                    device.wait('Основа оружия')
                    take(format_, 'sheet-weapon-item')
                    if 'sheet-weapon-details' in wanted:
                        for _ in range(5):
                            device.shell('input','swipe',str(format_['width']//2),str(int(format_['height']*.85)),str(format_['width']//2),str(int(format_['height']*.32)),'250')
                        take(format_, 'sheet-weapon-details')
                    device.click(description='Закрыть просмотр')
                    device.wait('Посох молнии')
            if 'sheet-inventory' in wanted:
                if format_['name']=='phone': device.click(description='Предметы')
                else: device.click(text='Снаряжение' if format_['name']=='wide' else 'Предметы')
                device.wait('фунт.')
                take(format_,'sheet-inventory')
            if wanted & {'sheet-magic','sheet-item-view'}:
                if format_['name']=='phone': device.click(description='Магия')
                else: device.click(text='Магия')
                device.wait('ЯЧЕЙКИ ЗАКЛИНАНИЙ')
                take(format_,'sheet-magic')
                if 'sheet-item-view' in wanted:
                    device.click(description='Действия с записью: '+fixture['recordName'])
                    device.click(text='Справочник')
                    device.wait(description='Закрыть просмотр')
                    device.wait(fixture['recordName'])
                    take(format_,'sheet-item-view')
                    device.click(description='Закрыть просмотр')
                    device.wait('ЯЧЕЙКИ ЗАКЛИНАНИЙ')
            if 'sheet-personality' in wanted:
                device.click(description='Личность') if format_['name']=='phone' else device.click(text='Личность')
                device.wait('Странница')
                take(format_, 'sheet-personality')
            if full and format_['name'] == 'phone':
                proof = verify_character_edit(device, url, fixture)
                (output.parent / 'native-character-edit.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2))
            device.shell('input', 'keyevent', '4')
            device.wait('Новый персонаж')
        if 'vtm-base' in wanted:
            device.click(text=fixture['characters'][1]['name'])
            device.wait('Тореадор')
            proof = verify_vtm_menu(device)
            (output.parent / ('native-vtm-menu-' + format_['name'] + '.json')).write_text(json.dumps(proof))
            take(format_, 'vtm-base')
            device.shell('input', 'keyevent', '4')
            device.wait('Новый персонаж')
    for entry in entries:
        entry['apkSHA256'] = apk_hash
    (output.parent / 'android.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2))
    (output.parent / 'native-session.json').write_text(json.dumps({'loginCount': login_count, 'firstCoverFetchVerified': cover_verified,
        'formats': [row['name'] for row in matrix['formats']], 'resizeWithoutReset': True}, indent=2))
