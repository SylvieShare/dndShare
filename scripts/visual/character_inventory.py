"""Inventory editing and tool checks through real Compose and a disposable API character."""
import http.cookiejar
import json
import re
import time
import urllib.parse
import urllib.request
import uuid

from android import build_install, login


def inventory_actions(device, root, url, output, fixture, stats):
    if urllib.parse.urlparse(url).hostname != '127.0.0.1' or fixture['login'] != 'native_tester':
        raise ValueError('Inventory checks require the disposable loopback fixture')
    owner = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, data=None, method=None):
        call = urllib.request.Request(url + path, data=json.dumps(data).encode() if data is not None else None,
                                      method=method, headers={'Content-Type': 'application/json'})
        with owner.open(call, timeout=25) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    request('/api/user/auth', {key: fixture[key] for key in ('login', 'password')})
    original = fixture['characters'][0]['uuid']
    before = request('/api/char/' + original)['data']
    clone = request('/api/char/' + original + '/clone', {}, 'POST')['uuid']
    checks = []

    def document():
        return request('/api/char/' + clone)

    def entries():
        model = document()['data']['values']['items']
        return model['equipped'] + [entry for space in model['sections'] for entry in space['items']]

    def entry(uid):
        return next((row for row in entries() if row['uid'] == uid), None)

    def wait(predicate, label):
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(.2)
        device.tree()
        raise AssertionError('Inventory check failed: ' + label)

    def scroll(tree, reverse=False):
        nodes = [node for node in tree.iter('node') if node.get('scrollable') == 'true']
        if not nodes:
            return
        left, top, right, bottom = map(int, re.findall(r'\d+', nodes[-1].get('bounds', '')))
        device.shell('input', 'swipe', str((left + right) // 2), str(top + 24 if reverse else bottom - 24),
                     str((left + right) // 2), str(bottom - 24 if reverse else top + 24), '300')

    def click(label, description=False):
        attr = 'content-desc' if description else 'text'
        for reverse in (False, True):
            previous = None
            for _ in range(12):
                tree = device.tree()
                nodes = [node for node in tree.iter('node') if node.get(attr) == label]
                if nodes:
                    device.tap(nodes[-1])
                    return
                signature = [(node.get('text'), node.get('bounds')) for node in tree.iter('node')]
                if signature == previous:
                    break
                previous = signature
                scroll(tree, reverse)
        raise AssertionError('Missing inventory control: ' + label)

    def enter(label, value):
        keyboard_close()
        for _ in range(12):
            tree = device.tree()
            edits = [node for node in tree.iter('node') if node.get('class') == 'android.widget.EditText']
            node = next((node for node in edits if node.get('content-desc') == label), None)
            if node is None:
                caption = next((node for node in tree.iter('node') if node.get('text') == label), None)
                if caption is not None:
                    box = list(map(int, re.findall(r'\d+', caption.get('bounds', ''))))
                    node = next((candidate for candidate in edits
                                 if (bounds := list(map(int, re.findall(r'\d+', candidate.get('bounds', '')))))
                                 and bounds[0] <= box[0] < bounds[2] and bounds[1] <= box[1] < bounds[3]), None)
            if node is not None:
                device.tap(node)
                device.shell('input', 'keyevent', '123')
                for _ in range(len(node.get('text', '')) + 2):
                    device.shell('input', 'keyevent', '67')
                device.shell('input', 'text', str(value).replace(' ', '%s'))
                return
            scroll(tree)
        raise AssertionError('Missing inventory field: ' + label)

    def keyboard_close():
        if 'mInputShown=true' in device.shell('dumpsys', 'input_method'):
            device.shell('input', 'keyevent', '4')

    def menu(name, action):
        click('Действия с предметом: ' + name, True)
        click(action)

    def checkpoint(label):
        checks.append(label)
        print('native inventory: ' + label, flush=True)
        (output / 'inventory-progress.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2))

    try:
        current = document()
        inventory = {'equipped': [], 'sections': [
            {'id': 'bag', 'name': 'Сумка', 'slots': {'staff:1': 0, 'tool:1': 1}, 'items': [
                {'uid': 'staff:1', 'item_id': 206, 'count': 2, 'params': {'kept': 7}},
                {'uid': 'tool:1', 'item_id': 216, 'count': 1, 'params': {}}]},
            {'id': 'chest', 'name': 'Сундук', 'slots': {}, 'items': []}]}
        request('/api/char/' + clone + '/data', {'baseVersion': current['version'], 'mutationId': str(uuid.uuid4()),
            'patches': [{'op': 'set', 'path': ['values', 'name'], 'value': 'InventoryHero'},
                        {'op': 'set', 'path': ['values', 'items'], 'value': inventory}]}, 'PATCH')
        build_install(device, root, url, output)
        device.shell('wm', 'density', '160')
        device.shell('wm', 'size', '390x900')
        login(device, fixture)
        click('Открыть меню', True)
        click('Персонажи')
        click('InventoryHero')
        click('Предметы', True)
        menu('Учебный посох', 'Добавить 1')
        wait(lambda: entry('staff:1')['count'] == 3, 'count persists')
        menu('Учебный посох', 'Экипировать')
        wait(lambda: any(row['uid'] == 'staff:1' for row in document()['data']['values']['items']['equipped']), 'equip')
        menu('Учебный посох', 'Переместить: Сундук')
        wait(lambda: 'staff:1' in document()['data']['values']['items']['sections'][1]['slots'], 'physical move')
        assert entry('staff:1')['params']['kept'] == 7
        checkpoint('count, equipment and cross-bag move persist without resetting instance state')
        menu('Учебный посох', 'Переместить в оружие')
        click('Сохранить')
        wait(lambda: entry('staff:1') is None, 'inventory removes converted stack')
        weapons = document()['data']['values']['weapon']
        converted = [row for row in weapons if row.get('params', {}).get('kept') == 7]
        assert len(converted) == 3 and converted[0]['uid'] == 'staff:1'
        assert len({row['uid'] for row in converted}) == 3 and all('count' not in row for row in converted)
        checkpoint('weapon conversion atomically splits the stack and preserves the first opaque UID')
        click('Свободная ячейка 1: Сундук', True)
        click('Своя вещь')
        enter('Своё название (необязательно)', 'MyRope')
        click('Иконка предмета: Тестовая сумка', True)
        enter('Вес одного предмета, фунт.', '2.75')
        enter('Количество', '3')
        keyboard_close()
        click('Расходуемое')
        click('Сохранить')
        wait(lambda: any(row.get('override', {}).get('name') == 'MyRope' for row in entries()), 'custom item saves')
        custom = next(row for row in entries() if row.get('override', {}).get('name') == 'MyRope')
        assert custom['count'] == 3 and custom['icon_preset_id'] == 12
        assert custom['override']['weight'] == 2.75 and custom['override']['consumable'] is True
        checkpoint('custom name, fractional weight, icon preset and consumable state round-trip through the API')
        menu('Учебный инструмент', 'Проверка инструментом')
        click('Сила')
        device.wait('Учебный инструмент — Сила')
        checkpoint('tool roll opens native ability selection and produces a result')
        device.shell('am', 'force-stop', 'ru.dndshare.client.smoke')
        device.shell('am', 'start', '-n', 'ru.dndshare.client.smoke/ru.dndshare.client.MainActivity')
        tree = device.tree()
        if any(node.get('content-desc') == 'К списку персонажей' for node in tree.iter('node')):
            click('К списку персонажей', True)
        else:
            click('Открыть меню', True)
            click('Персонажи')
        click('InventoryHero')
        click('Предметы', True)
        menu('MyRope', 'Изменить')
        tree = device.tree()
        assert any(node.get('text') == '2.75' for node in tree.iter('node'))
        assert any(node.get('checked') == 'true' and any(
            child.get('content-desc') == 'Иконка предмета: Тестовая сумка' for child in node.iter('node'))
                   for node in tree.iter('node')), 'Restored icon must be selected in native accessibility'
        click('Отмена')
        checkpoint('process restart restores saved custom metadata and cached icon selection')
    finally:
        request('/api/char/' + clone, method='DELETE')
        assert request('/api/char/' + original)['data'] == before
    (output / 'inventory-actions.json').write_text(json.dumps({'passed': True, 'realCompose': True,
        'realAPI': True, 'fixtureRestored': True, 'actions': checks}, ensure_ascii=False, indent=2))
