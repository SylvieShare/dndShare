import unittest
from prepare_tiefling_lineages import build_tiefling_lineages, LINEAGES

class TieflingTests(unittest.TestCase):
    def test_lineages_do_not_multiply_sizes_or_mix_spells(self):
        race = {'id': 9, 'data': {'speed': 30, 'rules_source': 'PHB 2024', 'description': '<p>Общий текст.</p>'+''.join('<h3>'+n+'</h3><p>'+n+' lore</p>' for n in LINEAGES)}}
        lineage = {'data': {'choices': [{'key': 'casting_ability'}]}}
        records, data, presence = build_tiefling_lineages(race, lineage, 8, lambda n:n)
        children = [r for r in records if r['typeId'] == 16]
        self.assertEqual(len(children), 3)
        self.assertEqual([r['label'] for r in data['variants']], ['Маленький', 'Средний'])
        self.assertTrue(all('size' not in r['data'] and 'variants' not in r['data'] for r in children))
        self.assertNotIn('<h3>', data['description'])
        self.assertEqual(presence['granted_spells'][0]['spell'], 'Чудотворство')
        magic = [r for r in records if r['data'].get('granted_spells')]
        self.assertEqual(len(magic), 3)
        for row, (_, _, spells) in zip(magic, LINEAGES.values()):
            self.assertTrue(row['data']['choice_only'])
            self.assertEqual([r['spell'] for r in row['data']['granted_spells']], spells)
            self.assertEqual([r['level'] for r in row['data']['granted_spells']], [1,3,5])
            self.assertTrue(all(r['ability_choice_source'] == 8 for r in row['data']['granted_spells']))

if __name__ == '__main__': unittest.main()
