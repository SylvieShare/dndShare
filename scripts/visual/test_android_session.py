"""Visual formats share one login while each capture starts on its expected screen."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from android import capture_android
from report import MATRIX


class Device:
    def __init__(self):
        self.screen = 'overview'
        self.images = 0
        self.logins = 0
        self.cover_loaded = False
        self.section = 'stats'
        self.resets = []

    def shell(self, *args):
        if args[:2] == ('am', 'force-stop') or args[:2] == ('pm', 'clear'):
            self.resets.append(args)
        if args == ('input', 'keyevent', '4'):
            self.screen = {'record': 'list', 'list': 'overview', 'dnd': 'characters', 'vtm': 'characters'}.get(self.screen, self.screen)

    def click(self, text=None, description=None):
        if description == 'Открыть меню':
            return
        if description == 'Редактировать: Сила':
            assert self.screen == 'dnd'
            self.screen = 'editor'
        elif text == 'База' or description == 'База':
            assert self.screen == 'dnd'
            self.section = 'base'
        elif text == 'Магия' or description == 'Магия':
            assert self.screen == 'dnd'
            self.section = 'magic'
        elif text in ('Персонажи', 'Справочник'):
            self.screen = 'characters' if text == 'Персонажи' else 'overview'
        elif text in ('Dnd', 'Vtm'):
            assert self.screen == 'characters', 'Next format must return to the list'
            self.screen = text.lower()
        elif text == 'Заклинания':
            assert self.screen == 'overview'
            self.screen = 'list'
        elif text == 'Record':
            assert self.screen == 'list'
            self.screen = 'record'
            if not self.cover_loaded:
                self.images += 1
                self.cover_loaded = True
        elif text == 'Отмена' or description == 'Закрыть редактор':
            self.screen = 'dnd'

    def wait(self, text=None, description=None):
        if text == 'Новый персонаж':
            assert self.screen == 'characters'
        elif text == 'Волшебник 4':
            assert self.section == 'base', 'Saved Stats selection must be explicitly switched to Base'


class AndroidSessionTest(unittest.TestCase):
    def test_one_login_for_sheet_handbook_vtm_and_combined_formats(self):
        for states in (['sheet-magic'], ['sheet-stats', 'sheet-stat-editor'], ['vtm-base'], ['collections', 'menu', 'list', 'record'], MATRIX['states']):
            with self.subTest(states=states), tempfile.TemporaryDirectory() as tmp:
                device = Device()
                output = Path(tmp) / 'android'; output.mkdir()
                fixture = {'characters': [{'name': 'Dnd'}, {'name': 'Vtm'}], 'recordName': 'Record', 'description': 'Description'}
                def login(*args):
                    device.logins += 1
                    device.screen = 'overview'
                def snapshot(device, output, format_, state, *args):
                    expected = {'collections': 'overview', 'menu': 'overview', 'list': 'list', 'record': 'record',
                                'character-list': 'characters', 'character-menu': 'characters', 'sheet-personality': 'dnd', 'sheet-base': 'dnd', 'sheet-death-saves': 'dnd', 'sheet-stats': 'dnd', 'sheet-stat-editor': 'editor', 'sheet-weapons': 'dnd', 'sheet-magic': 'dnd', 'sheet-inventory': 'dnd', 'vtm-base': 'vtm'}
                    self.assertEqual(device.screen, expected[state])
                    return {'format': format_['name'], 'state': state}
                def restore(*args):
                    device.screen = 'dnd'
                    return {}
                def swipes(*args):
                    device.section = 'stats'
                    return {}
                with patch('android.build_install', return_value='apk'), patch('android.login', side_effect=login), \
                        patch('android.snapshot', side_effect=snapshot), patch('android.verify_swipes', side_effect=swipes), \
                        patch('android.wait_absent'), patch('android.verify_form_restoration', side_effect=restore), \
                        patch('android.verify_character_edit', return_value={}), patch('android.verify_vtm_menu', return_value={}):
                    capture_android(device, Path(tmp), 'http://127.0.0.1:1234', output, dict(MATRIX, states=states), fixture,
                                    lambda: {'images': {'cover.svg': device.images}})
                self.assertEqual(device.logins, 1)
                if 'record' in states:
                    self.assertEqual(device.images, 1, 'Cached covers must work across window formats')
                self.assertEqual(device.resets, [])
                self.assertEqual(len(json.loads((Path(tmp) / 'android.json').read_text())), len(states) * 3)
                self.assertEqual(json.loads((Path(tmp) / 'native-session.json').read_text())['loginCount'], 1)
