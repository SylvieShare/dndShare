#!/usr/bin/env python3
"""Connect reviewed, public handbook entries to two-weapon fighting rules via MCP.

Requires MCP_URL and MCP_AUTH_TOKEN. Preview by default; deploy schema 170 before
--apply. Only the six named system entries below are read or changed.
"""
import argparse
import copy
import json
import os
import urllib.request

STYLE_NOTE = ('Добавление характеристики к урону второго оружия подключено к выбору '
              '«Бой двумя оружиями». Оборона и Стрельба рассчитываются автоматически; '
              'остальные варианты стиля применяются по описанию.')
SOURCES = {
    4058: ('Боевой стиль', 4, 'partial', STYLE_NOTE),
    4384: ('Боевой стиль', 4, 'partial', STYLE_NOTE),
    4390: ('Дополнительный боевой стиль', 4, 'partial', STYLE_NOTE),
    4341: ('Мастер парного оружия', 7, 'partial',
           'Разрешён урон бонусной атакой одноручного рукопашного оружия без свойства '
           '«лёгкое». Черта не добавляет модификатор урона. +1 КД при двух оружиях '
           'и доставание/убирание двух оружий учитываются вручную.'),
    7114: ('Амбидекстр', 7, 'partial',
           'Повышение характеристики и бонусная атака другим рукопашным оружием без '
           'свойства «двуручное» поддержаны. Предварительную атаку лёгким оружием '
           'и быстрое выхватывание игрок проверяет вручную. Черта не добавляет модификатор урона.'),
    7164: ('Сражение двумя оружиями', 7, 'full',
           'Модификатор характеристики сохраняется при выбранном уроне бонусным '
           'действием от атаки вторым оружием. Повторные источники не удваивают его.'),
}


def call(name, arguments):
    request = urllib.request.Request(os.environ['MCP_URL'],
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                         'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN'],
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        envelope = json.load(response)
    if 'error' in envelope or envelope['result'].get('isError'):
        raise RuntimeError('Handbook MCP request failed: ' + name)
    return envelope['result']['structuredContent']['result']


def publish(apply):
    if apply:
        for schema in call('handbook_item_types', {}):
            if schema['id'] not in (4, 7):
                continue
            derived = next(field for field in schema['fields'] if field['key'] == 'derived_effects')
            kinds = next(field for field in derived['fields'] if field['key'] == 'kind')
            if not {'two_weapon_damage_modifier', 'two_weapon_non_light'} <= {row['value'] for row in kinds['options']}:
                raise RuntimeError('Deploy schema 170 before publishing handbook rules')
    rows = call('handbook_items_get', {'ids': list(SOURCES)})
    if {row['id'] for row in rows} != set(SOURCES):
        raise RuntimeError('Expected exactly the six reviewed handbook entries')
    for item in rows:
        name, type_id, status, note = SOURCES[item['id']]
        if item['name'] != name or item['typeId'] != type_id:
            raise RuntimeError('Handbook identity changed: ' + str(item['id']))
        data = copy.deepcopy(item['data'])
        rule = {'kind': 'two_weapon_non_light' if item['id'] in (4341, 7114)
                else 'two_weapon_damage_modifier'}
        if type_id == 4:
            choices = [row for row in data.get('choices', []) if row.get('key') == 'choice']
            if len(choices) != 1 or 'two_weapon' not in {row['value'] for row in choices[0]['options']}:
                raise RuntimeError('Fighting style choices changed')
            rule.update(choice_key='choice', choice_values=['two_weapon'], label='Боевой стиль: Бой двумя оружиями')
        derived = data.setdefault('derived_effects', [])
        if rule not in derived:
            if any(row.get('kind') == rule['kind'] for row in derived):
                raise RuntimeError('A different two-weapon rule already exists: ' + str(item['id']))
            derived.append(rule)
        print(f'{"Update" if apply else "Preview"}: {item["id"]} {name}', flush=True)
        if not apply:
            continue
        call('handbook_item_update', {'id': item['id'], 'name': name,
            'nameEn': item.get('nameEn', ''), 'data': json.dumps(data, ensure_ascii=False),
            'automationStatus': status, 'automationNote': note})
        verified = call('handbook_items_get', {'ids': [item['id']]})[0]
        if verified['data'] != data or verified.get('automationStatus') != status or verified.get('automationNote') != note:
            raise RuntimeError('Handbook read-back differs: ' + str(item['id']))
    if apply:
        print('Verified all six public handbook entries; unrelated data preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    publish(parser.parse_args().apply)
