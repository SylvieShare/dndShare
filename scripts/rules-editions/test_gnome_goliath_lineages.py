import copy
import unittest
from prepare_gnome_goliath_lineages import build_lineages, GOLIATHS


def race(name, origins):
    return {'id': 42, 'name': name, 'data': {'description': '<p>Общее описание.</p>', 'speed': 35, 'creature_type': 'Гуманоид', 'rules_source': 'PHB 2024',
            'variants': [{'value': value, 'size': 'Средний', 'size_description': 'Рост', 'benefits': [{'text': value}]} for value in origins]}}


class OriginTests(unittest.TestCase):
    def test_goliath_grants_one_own_benefit_with_recovery(self):
        r = race('Голиаф', list(GOLIATHS))
        original = copy.deepcopy(r)
        desc = '<p>'+''.join(f'{feature} ({origin}). Уникальный эффект {n}. ' for n, (origin, (_, feature)) in enumerate(GOLIATHS.items()))+'</p>'
        rows, data = build_lineages(r, {'data': {'desc': desc}})
        self.assertEqual(r, original)
        self.assertNotIn('variants', data)
        self.assertEqual(sum(row['typeId'] == 16 for row in rows), 6)
        features = [row for row in rows if row['typeId'] == 3]
        self.assertEqual(len(features), 6)
        for n, feature in enumerate(features):
            self.assertEqual(feature['data']['desc'].count('Уникальный эффект'), 1)
            self.assertIn(f'Уникальный эффект {n}.', feature['data']['desc'])
            self.assertIn('Бонусу владения', feature['data']['desc'])
            self.assertIn('Долгого отдыха', feature['data']['desc'])
            self.assertEqual(feature['data']['race_ids'], [{'id': 42}])
            self.assertEqual(len(feature['data']['subrace_ids']), 1)

    def test_gnome_keeps_one_casting_choice_for_each_subrace(self):
        r = race('Гном', ['Лесной гном', 'Скальный гном'])
        lineage = {'data': {'choices': [{'key': 'casting_ability'}], 'desc': '<p>Лесной гном. Вы знаете заговор. Также говорите с животными. Скальный гном. Вы знаете два заговора. Кроме того, создаёте устройство.</p>'}}
        rows, _ = build_lineages(r, lineage)
        features = [row for row in rows if row['typeId'] == 3]
        self.assertEqual(len(features), 4)
        self.assertEqual(sum(bool(row['data'].get('choices')) for row in features), 2)
        self.assertNotIn('устройство', features[0]['data']['desc'])
        self.assertNotIn('животными', features[3]['data']['desc'])

    def test_rejects_unknown_variants(self):
        with self.assertRaises(ValueError):
            build_lineages(race('Голиаф', ['Неизвестный']), {'data': {'desc': ''}})
