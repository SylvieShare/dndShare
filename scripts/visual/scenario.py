"""Focused real-client scenarios; no broad screenshot loop on a failing lifecycle case."""
import json
import subprocess
from android import build_install, login
from adb import run
from character import verify_form_restoration


def form_lifecycle(device, root, url, output, fixture, stats):
    previous_trace = device.shell('getprop', 'log.tag.DndSheetNav')
    device.shell('setprop', 'log.tag.DndSheetNav', 'DEBUG')
    try:
        build_install(device, root, url, output)
        device.shell('wm', 'density', '160')
        device.shell('wm', 'size', '390x900')
        login(device, fixture)
        device.click(description='Открыть меню')
        device.click(text='Персонажи')
        device.click(text=fixture['characters'][0]['name'])
        device.click(description='Статы')
        device.wait('СИЛА')
        device.click(description='Редактировать: Сила')
        device.wait('Основное значение')
        try:
            result = verify_form_restoration(device, url, fixture, stats)
            (output / 'lifecycle.json').write_text(json.dumps(result, indent=2))
        finally:
            try:
                (output / 'navigation-log.txt').write_bytes(run([*device.command, 'logcat', '-d', '-s', 'DndSheetNav:D', '*:S']))
            except (RuntimeError, subprocess.SubprocessError):
                pass
    finally:
        device.shell('setprop', 'log.tag.DndSheetNav', previous_trace or "''")
