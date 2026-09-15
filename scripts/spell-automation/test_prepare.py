"""Catalogue regressions: never turn conditional text into unconditional rules."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class CataloguePlanTest(unittest.TestCase):
    def test_boundaries_and_parameters(self):
        records = [
            (990, 'Ускорение', {'description': 'Цель совершает с преимуществом спасброски Ловкости.'}),
            (725, 'Дыхание Борея', {'description': 'Существо должно совершать спасбросок Ловкости Сл 10 или упасть.'}),
            (1401, 'Множественное исцеление', {'description': 'Распределите 700 хитов между целями.', 'heal': {'dices': [{'bonus': 700}]}}),
            (752, 'Магическое оружие', {'description': 'Оружие получает бонус к атаке и урону.', 'lvl': 2, 'duration': 'Концентрация, до 1 часа', 'concentration': True}),
            (984, 'Стихийное оружие', {'description': 'Оружие получает бонус к атаке и дополнительный урон.', 'lvl': 3, 'duration': '1 час'}),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            snapshot = root / 'snapshot.jsonl'
            snapshot.write_text(json.dumps({'kind': 5, 'items': [
                {'id': id, 'name': name, 'data': data} for id, name, data in records
            ]}))
            subprocess.run([sys.executable, str(Path(__file__).with_name('prepare.py')), str(snapshot), str(root)], check=True, capture_output=True)
            plan = {row['id']: row for row in json.loads((root / 'plan.json').read_text())}
            effects = json.loads((root / 'effects.json').read_text())
        self.assertNotIn('damage', plan[990]['changes'])
        self.assertNotIn('damage', plan[725]['changes'])
        self.assertIs(plan[1401]['changes']['heal']['after']['apply'], False)
        magic = next(row for row in effects if row['spellId'] == 752)
        self.assertEqual(magic['parameter_bindings'][0]['step'], 2)
        self.assertEqual(magic['duration'], {'kind': 'hours', 'value': 1})
        self.assertEqual(len([row for row in effects if row['spellId'] == 984]), 5)
        # Elemental Weapon has an attack bonus and extra dice, not a flat damage bonus.
        for effect in effects:
            if effect['spellId'] == 984:
                self.assertEqual([row['kind'] for row in effect['data']['derived_effects']], ['weapon_attack_bonus'])
                self.assertIn('weapon_target', effect['data'])
        self.assertTrue(all(row['automationStatus'] != 'full' for row in plan.values()))


if __name__ == '__main__':
    unittest.main()
