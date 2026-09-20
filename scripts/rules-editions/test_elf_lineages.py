import copy
import unittest
from prepare_elf_lineages import build_elf_lineages, LINEAGES


class ElfLineagesTests(unittest.TestCase):
    def setUp(self):
        self.race = {'id': 20, 'data': {
            'description': '<p>Общие эльфы.</p>'+''.join('<h3>'+v[0]+'</h3><p>История '+name+'.</p>' for name, v in LINEAGES.items()),
            'variants': [{'value': n, 'size': 'Средний', 'size_description': '5–6 футов', 'benefits': [{'text': n}],
                          'speed': 35 if n == 'Лесной эльф' else 30} for n in LINEAGES],
            'speed': 30, 'creature_type': 'Гуманоид', 'rules_source': 'PHB 2024',
        }}
        self.lineage = {'data': {'choices': [{'key': 'casting_ability', 'count': 1}]}}

    def test_separates_lore_and_preserves_source(self):
        original = copy.deepcopy(self.race)
        records, data = build_elf_lineages(self.race, self.lineage)
        self.assertEqual(self.race, original)
        self.assertEqual(data['description'], '<p>Общие эльфы.</p>')
        self.assertNotIn('variants', data)
        subraces = [r for r in records if r['typeId'] == 16]
        self.assertEqual(len(subraces), 3)
        for subrace in subraces:
            self.assertEqual(subrace['data']['description'], '<p>История '+subrace['name']+'.</p>')
        self.assertEqual(next(r['data']['speed'] for r in subraces if r['name'] == 'Лесной эльф'), 35)

    def test_each_lineage_has_own_levels_and_one_casting_choice(self):
        records, _ = build_elf_lineages(self.race, self.lineage)
        for subrace in [r for r in records if r['typeId'] == 16]:
            own = [r['data'] for r in records if r['typeId'] == 3 and r['data']['subrace_ids'][0]['id']['$ref'] == subrace['key']]
            self.assertEqual([d['level'] for d in own if d['level'] > 1], [3, 5])
            self.assertEqual(sum(bool(d.get('choices')) for d in own), 1)
            self.assertTrue(all(d['race_ids'] == [{'id': 20}] for d in own))
        self.assertEqual(len({r['key'] for r in records}), 14)

    def test_rejects_missing_lore_or_unknown_lineage(self):
        self.race['data']['description'] = '<p>Already split</p>'
        with self.assertRaises(ValueError):
            build_elf_lineages(self.race, self.lineage)


if __name__ == '__main__':
    unittest.main()
