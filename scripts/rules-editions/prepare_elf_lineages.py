#!/usr/bin/env python3
"""Prepare PHB 2024 elf subraces and their own abilities from an MCP export.

Writes inspectable import/update requests only. Existing character references to
Elf Lineage remain valid; its public listing is retired after importing children.
"""
import argparse
import copy
import json
import re
from pathlib import Path
from content_common import key, ref
from species_details import paragraphs

LINEAGES = {
    'Дроу': ('Дроу', 'Пляшущие огоньки', 'Огонь фей', 'Тьма'),
    'Высший эльф': ('Высшие эльфы', 'Фокусы', 'Обнаружение магии', 'Туманный шаг'),
    'Лесной эльф': ('Лесные эльфы', 'Искусство друидов', 'Скороход', 'Бесследное передвижение'),
}
CASTING = 'Заклинательная характеристика — Интеллект, Мудрость или Харизма, выбранная для магии вашей родословной.'
SPELL_USE = ('Это заклинание всегда подготовлено. Вы можете сотворить его без траты ячейки один раз '
             'и восстанавливаете это использование после Долгого отдыха. Его также можно сотворять '
             'с тратой ячеек заклинаний подходящего уровня. ' + CASTING)


def build_elf_lineages(race, lineage):
    parts = re.split(r'<h3>(Дроу|Высшие эльфы|Лесные эльфы)</h3>', race['data']['description'])
    if len(parts) != 7:
        raise ValueError('Expected three distinct elf lore sections; do not overwrite an already converted race')
    lore = dict(zip(parts[1::2], parts[2::2]))
    variants = {v['value']: v for v in race['data']['variants']}
    if set(variants) != set(LINEAGES):
        raise ValueError('Unexpected elf variants')
    records = []
    for name, (heading, cantrip, third, fifth) in LINEAGES.items():
        variant = variants[name]
        subkey = key('subspecies', name)
        subdata = {'race': race['id'], 'description': lore[heading],
                   'short_description': ' '.join(b['text'] for b in variant['benefits'][:2]),
                   'size': variant['size'], 'size_description': variant['size_description'],
                   'speed': variant.get('speed', race['data']['speed']),
                   'creature_type': race['data']['creature_type'], 'rules_source': race['data']['rules_source']}
        records.append({'key': subkey, 'name': name, 'nameEn': '', 'typeId': 16, 'data': subdata,
                        'automationStatus': 'partial', 'automationNote': 'Размер и скорость применяются при создании. Способности привязаны отдельно; заклинания добавляются игроком.'})

        def ability(title, desc, level=1, choices=False):
            data = {'race_ids': [{'id': race['id']}], 'subrace_ids': [{'id': ref(subkey)}],
                    'desc': paragraphs(desc), 'level': level, 'level_source': 'bound',
                    'rules_source': race['data']['rules_source']}
            if choices:
                data['choices'] = copy.deepcopy(lineage['data']['choices'])
            records.append({'key': key('subspecies-feature', name+':'+title), 'name': title, 'nameEn': '',
                            'typeId': 3, 'data': data, 'automationStatus': 'partial' if choices else 'none',
                            'automationNote': 'Выбор заклинательной характеристики сохраняется. Заклинания добавляются игроком.' if choices else 'Правила PHB 2024; применение по описанию.'})

        if name == 'Дроу':
            ability('Тёмное зрение дроу', 'Дальность вашего Тёмного зрения увеличивается до 120 футов.')
        if name == 'Лесной эльф':
            ability('Скорость лесного эльфа', 'Ваша скорость увеличивается до 35 футов. Она учитывается при выборе этой подрасы.')
        desc = f'Вы знаете заговор «{cantrip}». '
        if name == 'Высший эльф':
            desc += 'После окончания Долгого отдыха вы можете заменить его другим заговором из списка заклинаний Волшебника. '
        ability('Магия: '+cantrip, desc+CASTING, choices=True)
        for level, spell in [(3, third), (5, fifth)]:
            ability('Магия: '+spell, f'С {level}-го уровня персонажа вы получаете заклинание «{spell}». '+SPELL_USE, level)
    data = copy.deepcopy(race['data'])
    data['description'] = parts[0]
    data.pop('variants')
    return records, data


def prepare(items):
    race = next(i for i in items if i['typeId'] == 8 and i['data'].get('edition_key') == key('species', 'Эльф'))
    lineage = next(i for i in items if i['typeId'] == 3 and i['data'].get('edition_key') == key('species-feature', 'Эльф:Эльфийская родословная'))
    records, data = build_elf_lineages(race, lineage)
    updates = [{'id': race['id'], 'name': race['name'], 'data': json.dumps(data, ensure_ascii=False),
                'automationNote': 'Общие особенности эльфа и выбор отдельной подрасы. Скорость подрасы и выбор характеристики колдовства учитываются; заклинания добавляются игроком.'},
               {'id': lineage['id'], 'name': lineage['name'], 'data': json.dumps(lineage['data'], ensure_ascii=False), 'hidden': True}]
    version = next(c['sourceVersionId'] for c in race['compatibility'] if c['status'] == 'native')
    return {'sourceVersionId': version, 'contentSourceId': race['contentSourceIds'][0], 'records': records}, updates


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('items', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    request, updates = prepare(json.loads(args.items.read_text()))
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, value in [('import.json', request), ('updates.json', updates)]:
        (args.output / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    print(f'Prepared {len(request["records"])} records and {len(updates)} updates')
