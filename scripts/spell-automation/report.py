#!/usr/bin/env python3
"""Generate a reproducible per-item audit from the reviewed catalogue plan."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('plan_directory')
parser.add_argument('output')
args = parser.parse_args()
root = Path(args.plan_directory)
plan = json.loads((root / 'plan.json').read_text())
effects = json.loads((root / 'effects.json').read_text())
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
with (output / 'spells.csv').open('w', newline='') as stream:
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(['id', 'name', 'automation_status', 'requires_player_interaction', 'note'])
    for item in plan:
        writer.writerow([item['id'], item['name'], item['automationStatus'], item['requiresPlayerInteraction'], item['automationNote']])
with (output / 'effects.csv').open('w', newline='') as stream:
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(['spell_id', 'key', 'name', 'effect_id'])
    applied = json.loads((root / 'applied.json').read_text()) if (root / 'applied.json').exists() else {}
    links = {link['key']: link['effect']['id'] for rows in applied.get('effectLinks', {}).values() for link in rows}
    for effect in effects:
        writer.writerow([effect['spellId'], effect['key'], effect['name'], links.get(effect['key'], '')])
print(json.dumps({'spells': len(plan), 'statuses': Counter(item['automationStatus'] for item in plan),
                  'effects': len(effects), 'effectSpells': len({effect['spellId'] for effect in effects})}, ensure_ascii=False))
