"""Native character actions against the disposable API. Operates on copies only."""
import http.cookiejar
import json
import time
import urllib.parse
import urllib.request

from adb import PACKAGE
from android import build_install, login
from native_controls import NativeControls


def character_actions(device, root, url, output, fixture, stats):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'} or fixture['login'] != 'native_tester':
        raise ValueError('Character action checks require the local disposable fixture')
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    created = set()
    evidence = []

    def request(path, data=None, method=None):
        req = urllib.request.Request(url + path, data=json.dumps(data).encode() if data is not None else None,
                                     method=method, headers={'Content-Type': 'application/json'})
        with opener.open(req, timeout=20) as response:
            payload = response.read()
            return json.loads(payload) if payload else None

    request('/api/user/auth', {key: fixture[key] for key in ('login', 'password')})
    originals = {row['uuid']: request('/api/char/' + row['uuid'])['data'] for row in fixture['characters']}

    def saved(uuid, predicate):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            doc = request('/api/char/' + uuid)
            if predicate(doc['data']['values']):
                return doc
            time.sleep(.2)
        raise AssertionError('Native action did not reach the versioned API: ' + uuid)

    def text(value, index=0, label=None):
        if label is not None:
            return controls.enter(label, value)
        if 'mInputShown=true' in device.shell('dumpsys','input_method'):
            device.shell('input','keyevent','4')
            device.tree()
        tree=device.tree()
        nodes = [n for n in tree.iter('node') if n.get('class') == 'android.widget.EditText']
        if len(nodes) <= index:
            raise AssertionError('Missing native input; see ' + str(device.output))
        node = nodes[index]
        device.tap(node)
        device.shell('input', 'keyevent', '123')
        for _ in range(len(node.get('text', '')) + 2):
            device.shell('input', 'keyevent', '67')
        device.shell('input', 'text', str(value).replace(' ', '%s'))

    def find(label, description=False):
        for _ in range(8):
            tree = device.tree()
            attr = 'content-desc' if description else 'text'
            if any(n.get(attr) == label for n in tree.iter('node')):
                device.click(**({'description': label} if description else {'text': label}))
                return
            device.shell('input', 'swipe', '195', '740', '195', '270', '350')
        raise AssertionError('Native control is not reachable: ' + label)

    def checkpoint(label, uuid=None):
        print('native character actions: ' + label, flush=True)
        step = {'action': label}
        if uuid:
            step['version'] = request('/api/char/' + uuid)['version']
        evidence.append(step)
        (output / 'character-actions-progress.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
        (device.output / ('actions-' + str(len(evidence)) + '.png')).write_bytes(device.pixels())

    controls = NativeControls(device)
    build_install(device, root, url, output)
    device.shell('wm', 'density', '160')
    device.shell('wm', 'size', '390x900')
    login(device, fixture)
    device.click(description='Открыть меню')
    device.click(text='Персонажи')
    try:
        original_name = fixture['characters'][0]['name']
        device.click(description='Действия: ' + original_name)
        device.click(text='Клонировать')
        name = original_name + ' (копия)'
        device.wait(name)
        clones = [row for row in request('/api/chars')['chars'] if row['uuid'] not in originals]
        if len(clones) != 1:
            raise AssertionError('Cloning must create exactly one character')
        uuid = clones[0]['uuid']; created.add(uuid)
        device.click(text=name)
        device.wait(description='К списку персонажей')
        find(name)
        device.wait('Имя персонажа')
        text('ParityHero')
        device.click(text='Сохранить')
        saved(uuid, lambda values: values['name'] == 'ParityHero')
        checkpoint('clone and rename', uuid)

        device.click(description='Предметы')
        find('Изменить кошелёк', description=True)
        device.wait('Сохранить')
        # The first currency in the fixture wallet is copper.
        controls.enter('Медные монеты', '37')
        controls.keyboard_close()
        device.click(text='Сохранить')
        saved(uuid, lambda values: values['money']['amounts'].get('1') == 37)
        checkpoint('wallet and native keyboard', uuid)

        tree=device.tree()
        empty=next(node.get('content-desc') for node in tree.iter('node') if node.get('content-desc','').startswith('Свободная ячейка'))
        controls.click(empty,True);controls.click('Своя вещь')
        device.wait('Своё название (необязательно)')
        text('NativeRope',label='Своё название (необязательно)')
        text('Field notes',label='Описание')
        text('2',label='Количество')
        device.click(text='Сохранить')
        def custom(values):
            return any((row.get('override') or {}).get('name') == 'NativeRope' and row['count'] == 2
                       for section in values['items']['sections'] for row in section['items'])
        saved(uuid, custom)
        checkpoint('custom inventory entry', uuid)

        device.click(description='Магия')
        find('+ Вкладка')
        device.wait('Название книги')
        text('NativeMagic')
        device.click(text='Сохранить')
        saved(uuid, lambda values: any(row['name'] == 'NativeMagic' for row in values['spells']['tabs']))
        checkpoint('spellbook creation', uuid)

        device.click(description='База')
        find('Отдых')
        device.wait('Восстановление')
        device.click(text='Долгий отдых')
        device.click(text='Сохранить')
        saved(uuid, lambda values: values['hp']['current'] == values['hp']['max']['base'] + 8 and values['hp']['temp'] == 0)
        checkpoint('long rest', uuid)


        device.click(description='Дневник')
        find('Новый раздел')
        device.wait('Название раздела')
        text('NativeSection',label='Название раздела')
        device.click(text='Применить')
        def journal_saved(predicate):
            deadline=time.monotonic()+35
            while time.monotonic()<deadline:
                result=request('/api/char/'+uuid+'/journal')['journal']
                if result and predicate(result):return result
                time.sleep(.2)
            device.tree()
            raise AssertionError('Native journal action was not confirmed')
        journal_saved(lambda journal:any(section['title']=='NativeSection' for section in journal['sections']))
        find('NativeSection')
        find('Добавить запись')
        device.wait('Название записи')
        text('NativeEntry',label='Название записи')
        text('JournalNotes',label='Описание')
        device.click(text='Применить')
        def entries(journal):
            return [entry for section in journal['sections'] if section['title']=='NativeSection' for entry in section['events']]
        journal_saved(lambda journal:any(entry['title']=='NativeEntry' and 'JournalNotes' in entry['desc'] for entry in entries(journal)))
        find('Изменить')
        device.wait('Название записи')
        text('NativeEntryEdited',label='Название записи')
        device.click(text='Применить')
        journal_saved(lambda journal:any(entry['title']=='NativeEntryEdited' and 'JournalNotes' in entry['desc'] for entry in entries(journal)))
        checkpoint('journal section and rich entry creation and edit',uuid)

        device.click(description='База')
        find('УР.')
        device.wait('Развитие персонажа')
        find('Повысить уровень 4 → 5')
        device.wait('Класс')
        device.click(text='Сохранить')
        saved(uuid,lambda values:values['lvl']['level']==5 and values['classes'][0]['level']==5 and values['hp']['hitDice'][0]['total']==5)
        checkpoint('atomic native level advancement',uuid)

        device.shell('am', 'force-stop', PACKAGE)
        device.shell('am', 'start', '-W', '-n', PACKAGE + '/ru.dndshare.client.MainActivity')
        tree=device.tree()
        if any(node.get('content-desc')=='К списку персонажей' for node in tree.iter('node')):
            device.click(description='К списку персонажей')
        else:
            device.wait(description='Открыть меню')
            device.click(description='Открыть меню'); device.click(text='Персонажи')
        find('ParityHero')
        device.wait(description='К списку персонажей')
        checkpoint('restart keeps saved changes', uuid)
        device.click(description='К списку персонажей')
        find('Действия: ParityHero', description=True)
        device.click(text='Удалить'); device.click(text='Удалить')
        deadline = time.monotonic() + 20
        while any(row['uuid'] == uuid for row in request('/api/chars')['chars']):
            if time.monotonic() > deadline:
                raise AssertionError('Delete did not remove the character from the list')
            time.sleep(.2)
        created.remove(uuid)
        checkpoint('delete copy')

        device.click(description='Новый персонаж')
        device.wait('Vampire V20')
        device.click(text='Vampire V20')
        device.wait('Vampire: The Masquerade V20')
        text('NativeVampire')
        device.click(text='Создать')
        device.wait('NativeVampire')
        new_rows = [row for row in request('/api/chars')['chars'] if row['uuid'] not in originals]
        if len(new_rows) != 1:
            raise AssertionError('VTM creation must create exactly one character')
        vtm = new_rows[0]['uuid']; created.add(vtm)
        saved(vtm, lambda values: values['char_name'] == 'NativeVampire')
        checkpoint('VTM creation wizard', vtm)
        find('Запас крови: 0 / 20')
        device.wait('Текущий запас крови')
        text('7'); text('15',1)
        device.click(text='Сохранить')
        saved(vtm, lambda values: values.get('blood_pool') == {'current': 7, 'max': 15})
        checkpoint('VTM blood pool', vtm)
    finally:
        for uuid in created:
            request('/api/char/' + uuid, method='DELETE')
        for uuid, document in originals.items():
            if request('/api/char/' + uuid)['data'] != document:
                raise AssertionError('Character checks changed the shared original fixture')
    (output / 'character-actions.json').write_text(json.dumps({'passed': True, 'realCompose': True,
        'realAPI': True, 'copiesOnly': True, 'fixtureRestored': True, 'actions': evidence}, ensure_ascii=False, indent=2))
