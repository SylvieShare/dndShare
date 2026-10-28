"""Native document picker, crop and real image APIs against the disposable local S3 boundary."""
import http.cookiejar
import json
import struct
import time
import urllib.parse
import urllib.request
import uuid
import zlib

from adb import PACKAGE, native_path, run
from android import build_install, login


def media_actions(device, root, url, output, fixture, stats):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!="http" or parsed.hostname!="127.0.0.1" or fixture["login"]!="native_tester":
        raise ValueError("Media checks require the disposable loopback fixture")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, data=None, method=None):
        req = urllib.request.Request(url + path, data=json.dumps(data).encode() if data is not None else None,
                                     method=method, headers={'Content-Type': 'application/json'})
        with opener.open(req, timeout=25) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    request('/api/user/auth', {key: fixture[key] for key in ('login', 'password')})
    original = fixture['characters'][0]['uuid']
    before = request('/api/char/' + original)['data']
    clone = request('/api/char/' + original + '/clone', {}, 'POST')['uuid']
    remote_file = '/sdcard/Download/dndshare-native-media-' + uuid.uuid4().hex + '.png'
    name = remote_file.rsplit('/', 1)[1]
    sample = output / name

    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)

    rows = b''.join(b'\0' + bytes((64 + y % 128, 80, 180, 255)) * 480 for y in range(640))
    sample.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 480, 640, 8, 6, 0, 0, 0)) +
                       chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
    checks = []

    def click(label, description=False):
        attr = 'content-desc' if description else 'text'
        for _ in range(12):
            nodes = [node for node in device.tree().iter('node') if node.get(attr) == label]
            if nodes:
                device.tap(nodes[-1])
                return
            device.shell('input', 'swipe', '195', '720', '195', '280', '300')
        raise AssertionError('Missing native media control: ' + label)

    def choose_file():
        click('Выбрать изображение')
        for _ in range(15):
            tree = device.tree()
            found = [node for node in tree.iter('node') if node.get('text') == name or node.get('content-desc','').startswith(name+',')]
            if found:
                device.tap(found[-1])
                device.wait('Применить обрезку')
                click('Применить обрезку')
                device.wait('Изменить обрезку')
                click('Сохранить')
                return
            roots = [node for node in tree.iter('node') if node.get('content-desc') in {'Show roots', 'Показать корни', 'Открыть панель навигации'}]
            downloads = [node for node in tree.iter('node') if node.get('text') in {'Downloads', 'Загрузки', 'Download'}]
            if downloads:
                device.tap(downloads[-1])
            elif roots:
                device.tap(roots[0])
            else:
                time.sleep(.3)
        raise AssertionError('The Android document picker did not expose the injected test image')

    def saved(predicate):
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            doc = request('/api/char/' + clone)
            if predicate(doc):
                return doc
            time.sleep(.2)
        device.tree()
        raise AssertionError('The native media edit did not reach the API')

    def checkpoint(label):
        checks.append(label)
        print('native media actions: ' + label, flush=True)
        (output / 'media-actions-progress.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2))

    try:
        document = request('/api/char/' + clone)
        request('/api/char/' + clone + '/data', {'baseVersion': document['version'], 'mutationId': str(uuid.uuid4()),
                'patches': [{'op': 'set', 'path': ['values', 'name'], 'value': 'MediaHero'}]}, 'PATCH')
        build_install(device, root, url, output)
        run([*device.command, 'push', native_path(sample), remote_file])
        device.shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file://' + remote_file)
        device.shell('wm', 'density', '160')
        device.shell('wm', 'size', '390x900')
        login(device, fixture)
        click('Открыть меню', True)
        click('Персонажи')
        click('MediaHero')
        click('Меню')
        click('Портрет')
        choose_file()
        portrait = saved(lambda doc: doc['data']['values'].get('ava', {}).get('url', '').find('/__test/media/') >= 0)['data']['values']['ava']
        with opener.open(portrait['url'], timeout=20) as response:
            assert response.headers['Content-Type'] == 'image/webp'
            assert response.read(4) == b'RIFF'
        checkpoint('native document picker and portrait WebP upload')
        click('Меню')
        click('Иконка')
        choose_file()
        icon = saved(lambda doc: '/__test/media/' in (doc.get('iconImageUrl') or ''))['iconImageUrl']
        with opener.open(icon, timeout=20) as response:
            header = response.read(24)
            assert header.startswith(b'\x89PNG\r\n\x1a\n')
            assert struct.unpack('>II', header[16:24]) == (256, 256)
        checkpoint('native icon crop and character icon API')
        device.shell('am', 'force-stop', PACKAGE)
        device.shell('am', 'start', '-W', '-n', PACKAGE + '/ru.dndshare.client.MainActivity')
        device.wait(description='Открыть меню')
        after = request('/api/char/' + clone)
        assert after['data']['values']['ava'] == portrait and after['iconImageUrl'] == icon
        checkpoint('image references survive application restart')
    finally:
        request('/api/char/' + clone, method='DELETE')
        device.shell('rm', '-f', remote_file)
        assert request('/api/char/' + original)['data'] == before
    (output / 'media-actions.json').write_text(json.dumps({'passed': True, 'realCompose': True, 'realAPI': True,
        'nativePicker': True, 'localS3': True, 'fixtureRestored': True, 'actions': checks}, ensure_ascii=False, indent=2))
