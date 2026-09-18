#!/usr/bin/env python3
"""Prepare a conservative review from a complete MCP snapshot; never writes live data."""
import argparse, copy, json, re
from collections import Counter
from pathlib import Path
from definitions import EFFECTS, FULL_DAMAGE
from patches import patch
from stages import patch_stages
from conditional import patch_conditional
META = ['automationStatus', 'automationNote', 'requiresPlayerInteraction']
def duration(data):
    for token, kind in [('раунд', 'rounds'), ('минут', 'minutes'), ('час', 'hours')]:
        m = re.search(r'(\d+)\s*'+token, data.get('duration', '').lower())
        if m: return {'kind': kind, 'value': int(m[1])}
    return {'kind': 'manual'}
def prepare(spells):
    plans, effects = [], []
    for item in spells:
        id = item['id']; original = item['data']; data = copy.deepcopy(original)
        status, note = item['automationStatus'], item.get('automationNote', '')
        change_note = patch(id, data)
        stage_note = patch_stages(id, data)
        if stage_note: change_note = stage_note
        conditional_note = patch_conditional(id, data)
        if conditional_note: change_note = conditional_note
        if change_note: status, note = 'partial', change_note
        specs = [s for s in EFFECTS if s['id'] == id]
        if specs:
            status = 'partial'
            notes = [s['note'] for s in specs if s['note']]
            note = 'Применяются связанные эффекты и указанные в них модификаторы. ' + (' '.join(dict.fromkeys(notes)) if notes else 'Условия наложения, повторные спасброски и снятие по ходу боя проверяются участниками.')
        for spec in specs:
            key = f"spell_{id}_{spec['key']}"; timed = spec['duration'] or duration(data)
            # Short secondary states end by their own timing even when the source
            # spell continues (e.g. Shadow Puppets' incapacitation).
            concentration = bool(data.get('concentration')) and spec['duration'] is None
            effect_data = {'code': key, 'desc': spec['desc'], 'polarity': spec['polarity'], 'stacking': 'single',
                'duration': timed, 'concentration': concentration, 'derived_effects': spec['rules'],
                'application_sources': [{'item': {'id': id}, 'key': key, 'target': 'self' if data.get('application_targets', {}).get('self_only') else 'other', 'condition': spec['condition']}], **spec['extra']}
            effects.append({'spellId': id, 'key': key, 'name': spec['title'] if spec['title'] not in ['Отравление', 'Недееспособность'] else item['name']+': '+spec['title'].lower(),
                'nameEn': item.get('nameEn', ''), 'data': effect_data, 'condition': spec['condition'], 'duration': timed,
                'duration_levels': [{'level': n, 'duration': {'kind': 'minutes', 'value': n-2}} for n in range(4, 10)] if id == 975 else []})
        if id in FULL_DAMAGE:
            status = 'full'
            note = 'Проверены атака или спасбросок, формула и типы урона, усиление, применение результата к целям из хроники. Геометрия, перемещение, освещение и воздействие на декорации остаются у мастера и не снижают статус.'
        changes = {k: {'before': original.get(k), 'after': v} for k, v in data.items() if original.get(k) != v}
        if changes or specs or status != item['automationStatus'] or note != item.get('automationNote', ''):
            plans.append({'id': id, 'name': item['name'], 'changes': changes, 'automationStatus': status, 'automationNote': note[:1000],
                'requiresPlayerInteraction': item.get('requiresPlayerInteraction', False) or id == 1100,
                'metadataBefore': {k: item.get(k, False if k == 'requiresPlayerInteraction' else '') for k in META},
                'effectsBefore': original.get('status_effects', [])})
    return plans, effects

def main():
    p = argparse.ArgumentParser(); p.add_argument('snapshot'); p.add_argument('output'); args = p.parse_args()
    spells = json.loads(Path(args.snapshot).read_text()); plan, effects = prepare(spells)
    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    for file, data in [('plan.json', plan), ('effects.json', effects)]: (out/file).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'reviewedChanges': len(plan), 'mechanicalChanges': sum(bool(x['changes']) for x in plan), 'newEffects': len(effects), 'fullPromotions': sum(x['automationStatus']=='full' for x in plan)}, ensure_ascii=False))
if __name__ == '__main__': main()
