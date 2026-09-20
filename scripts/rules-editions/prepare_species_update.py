#!/usr/bin/env python3
"""Build an inspectable MCP import and updates from a current item export.

No network access or writes to the catalogue. Save the original export before
applying; import features first, then update species and retire old aggregates.
"""
import argparse
import json
from pathlib import Path
from content_common import key
from species_details import split_species, enrich_species, feature_data


def prepare(items):
    races = [item for item in items if item['typeId'] == 8]
    aggregates = {row['data']['race_ids'][0]['id']: row for row in items if row['typeId'] == 3}
    if len(races) != 10 or len(aggregates) != 10:
        raise ValueError('Expected 10 PHB 2024 species and 10 aggregate abilities')
    records, updates = [], []
    for race in races:
        aggregate = aggregates[race['id']]
        lore, features = split_species(race['name'], race['data']['description'])
        data = enrich_species(race['name'], {**race['data'], 'description': lore}, features)
        updates.append({'id': race['id'], 'name': race['name'], 'data': json.dumps(data, ensure_ascii=False),
                        'automationNote': 'Скорость, размер, языки и выбор происхождения. Особенности вида оформлены отдельными способностями.'})
        for feature in features:
            feature_rules = feature_data(race['name'], feature, aggregate['data'])
            feature_rules['rules_source'] = aggregate['data']['rules_source']
            automated = bool(feature_rules.get('hp_bonuses') or feature_rules.get('choices'))
            records.append({'key': key('species-feature', race['name']+':'+feature['name']), 'name': feature['name'],
                            'nameEn': '', 'typeId': 3, 'data': feature_rules,
                            'automationStatus': 'partial' if automated else 'none',
                            'automationNote': 'Сохранены выбор характеристики или прибавка хитов; прочие эффекты по описанию.' if automated else 'Правила PHB 2024; применение по описанию.'})
        # Old character references remain valid. Only new catalogue selections
        # stop offering the obsolete aggregate; its existing mechanics stay intact.
        old_data = {**aggregate['data'], 'desc': ''.join('<h3>'+feature['name']+'</h3>'+feature['data']['desc'] for feature in features)}
        updates.append({'id': aggregate['id'], 'name': aggregate['name'], 'data': json.dumps(old_data, ensure_ascii=False), 'hidden': True})
    native = next(c['sourceVersionId'] for c in races[0]['compatibility'] if c['status'] == 'native')
    return {'contentSourceId': races[0]['contentSourceIds'][0], 'sourceVersionId': native, 'records': records}, updates


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('items', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    request, updates = prepare(json.loads(args.items.read_text()))
    for filename, data in [('import.json', request), ('updates.json', updates)]:
        (args.output / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(f"Prepared {len(request['records'])} individual abilities and {len(updates)} updates")
