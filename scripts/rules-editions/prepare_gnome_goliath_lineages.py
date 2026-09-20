#!/usr/bin/env python3
"""Prepare separate PHB 2024 gnome and goliath origins; no network writes."""
import argparse
import copy
import json
import re
from pathlib import Path
from content_common import key, ref
from species_details import paragraphs, plain

GOLIATHS = {
    'Облачный великан': ('Облачный голиаф', 'Прогулка на облаках'),
    'Огненный великан': ('Огненный голиаф', 'Ожог от огня'),
    'Ледяной великан': ('Ледяной голиаф', 'Дрожь от холода'),
    'Холмовой великан': ('Холмовой голиаф', 'Падение с холма'),
    'Каменный великан': ('Каменный голиаф', 'Крепость камня'),
    'Штормовой великан': ('Штормовой голиаф', 'Грохот бури'),
}
GNOME_LORE = {
    'Лесной гном': 'Лесные гномы скрытны, дружат с мелким зверьём и владеют крупицей иллюзорной магии.',
    'Скальный гном': 'Скальные гномы — прирождённые изобретатели и мастеровые.',
}
CASTING = 'Заклинательная характеристика этих заклинаний — Интеллект, Мудрость или Харизма (выберите при выборе родословной).'


def build_lineages(race, lineage):
    name, data = race['name'], race['data']
    variants = data.get('variants', [])
    expected = set(GNOME_LORE if name == 'Гном' else GOLIATHS)
    if {v['value'] for v in variants} != expected:
        raise ValueError('Unexpected variants for '+name)
    records = []
    rules = plain(lineage['data']['desc'])
    for variant in variants:
        origin = variant['value']
        title = origin if name == 'Гном' else GOLIATHS[origin][0]
        subkey = key('subspecies', title)
        lore = GNOME_LORE[origin] if name == 'Гном' else f'Ваше происхождение — {origin.lower()}. Вы сохраняете общие особенности голиафа и получаете сверхъестественный дар этих предков.'
        records.append({'key': subkey, 'name': title, 'nameEn': '', 'typeId': 16,
                        'data': {'race': race['id'], 'description': paragraphs(lore),
                                 'short_description': ' '.join(b['text'] for b in variant['benefits']),
                                 'size': variant['size'], 'size_description': variant['size_description'],
                                 'speed': data['speed'], 'creature_type': data['creature_type'], 'rules_source': data['rules_source']},
                        'automationStatus': 'partial', 'automationNote': 'Общие параметры наследуются от вида; способности представлены отдельными записями. Эффекты по описанию.'})

        def ability(title, description, choices=False):
            d = {'race_ids': [{'id': race['id']}], 'subrace_ids': [{'id': ref(subkey)}], 'level': 1,
                 'level_source': 'bound', 'desc': paragraphs(description), 'rules_source': data['rules_source']}
            if choices: d['choices'] = copy.deepcopy(lineage['data']['choices'])
            records.append({'key': key('subspecies-feature', subkey.removeprefix('phb2024:subspecies:')+':'+title),
                            'name': title, 'nameEn': '', 'typeId': 3, 'data': d,
                            'automationStatus': 'partial' if choices else 'none',
                            'automationNote': 'Выбор характеристики сохраняется; заклинания и эффекты применяются игроком.' if choices else 'Применение по описанию PHB 2024.'})

        if name == 'Гном':
            start = rules.index(origin+'.') + len(origin)+1
            end = rules.index('Скальный гном.') if origin == 'Лесной гном' else len(rules)
            own = rules[start:end].strip()
            if origin == 'Лесной гном':
                cantrip, animal = own.split('Также ', 1)
                ability('Малая иллюзия лесного гнома', cantrip+' '+CASTING, True)
                ability('Разговор с животными лесного гнома', 'Также '+animal+' '+CASTING)
            else:
                spells, device = own.split('Кроме того, ', 1)
                ability('Магия скального гнома', spells+' '+CASTING, True)
                ability('Заводное устройство', 'Кроме того, '+device+' '+CASTING)
        else:
            feature = GOLIATHS[origin][1]
            positions = [(rules.index(f'{f} ({o}).'), o, f) for o, (_, f) in GOLIATHS.items()]
            positions.sort()
            index = next(i for i, (_, o, _) in enumerate(positions) if o == origin)
            start = positions[index][0]+len(f'{feature} ({origin}).')
            end = positions[index+1][0] if index+1 < len(positions) else len(rules)
            own = rules[start:end].strip()
            ability(feature, own+'\n\nВы можете использовать это преимущество количество раз, равное вашему Бонусу владения. Все потраченные использования восстанавливаются после окончания Долгого отдыха.')
    updated = copy.deepcopy(data)
    updated.pop('variants')
    return records, updated


def prepare(items):
    records, updates = [], []
    for name, feature in [('Гном', 'Гномья родословная'), ('Голиаф', 'Великание происхождение')]:
        race = next(r for r in items if r['typeId'] == 8 and r['data'].get('edition_key') == key('species', name))
        lineage = next(r for r in items if r['typeId'] == 3 and r['data'].get('edition_key') == key('species-feature', name+':'+feature))
        children, data = build_lineages(race, lineage)
        records.extend(children)
        updates.extend([{'id': race['id'], 'name': race['name'], 'data': json.dumps(data, ensure_ascii=False)},
                        {'id': lineage['id'], 'name': lineage['name'], 'data': json.dumps(lineage['data'], ensure_ascii=False), 'hidden': True}])
    return {'sourceVersionId': 1799, 'contentSourceId': 23506, 'records': records}, updates


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('items', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    request, updates = prepare(json.loads(args.items.read_text()))
    args.output.mkdir(parents=True, exist_ok=True)
    for file, value in [('import.json', request), ('updates.json', updates)]:
        (args.output/file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    print(f'Prepared {len(request["records"])} records and {len(updates)} updates')
