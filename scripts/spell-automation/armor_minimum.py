#!/usr/bin/env python3
"""Reviewed AC floors for the separate 2014/2024 editions; prepare only."""
import argparse, json
from pathlib import Path

def prepare(rows):
    by_id = {row['id']: row for row in rows}
    plans, effects = [], []
    for id, value, concentration in [(724, 16, True), (6142, 17, False)]:
        item = by_id[id]
        key = f'spell_{id}_armor_minimum'
        condition = 'Цель согласна; заклинатель касается её.'
        duration = {'kind': 'hours', 'value': 1}
        data = {'code': key, 'desc': f'КД не может быть ниже {value}. Доспех, щит и остальные бонусы учитываются до сравнения с этим минимумом.',
            'polarity': 'positive', 'stacking': 'single', 'concentration': concentration, 'duration': duration,
            'derived_effects': [{'kind': 'armor_minimum', 'value': value}],
            'application_sources': [{'item': {'id': id}, 'key': key, 'target': 'other', 'condition': condition}]}
        effects.append({'spellId': id, 'key': key, 'name': item['name'], 'nameEn': item.get('nameEn', ''), 'data': data, 'condition': condition, 'duration': duration})
        plans.append({'id': id, 'name': item['name'], 'changes': {}, 'automationStatus': 'full', 'requiresPlayerInteraction': False,
            'automationNote': f'Применение к согласной цели, минимум итогового КД {value} после щита и бонусов у персонажей и НПС. Длительность 1 час' + (' и связь с концентрацией.' if concentration else '; без концентрации.'),
            'metadataBefore': {k: item.get(k) for k in ['automationStatus', 'automationNote', 'requiresPlayerInteraction']},
            'effectsBefore': item['data'].get('status_effects', [])})
    return plans, effects

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('snapshot'); parser.add_argument('directory'); args = parser.parse_args()
    plans, effects = prepare(json.loads(Path(args.snapshot).read_text()))
    root = Path(args.directory); root.mkdir(parents=True, exist_ok=True)
    for name, rows in [('plan', plans), ('effects', effects)]:
        (root / f'{name}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    print('Prepared 2 spells and 2 effects.')
