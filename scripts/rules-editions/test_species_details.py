import unittest
from species_details import split_species, enrich_species, feature_data

GNOME = ('<p>Гномы живут в лесах и норах.</p><h3>Особенности Гномов</h3>'
         '<p>Тип существа: Гуманоид<br>Размер: Маленький (3–4 фута)<br>Скорость: 30 футов</p>'
         '<p>Гном обладает следующими особенностями вида: Тёмное зрение. Видит на 60 футов. '
         'Гномья хитрость. Преимущество спасбросков. Гномья родословная. Выберите заклинательную характеристику.</p>'
         '<p>Выберите один из следующих вариантов:</p><p>Лесной гном. Малая иллюзия и разговор с животными. '
         'Скальный гном. Починка и Фокусы. Создание трёх устройств.</p>')


class SpeciesDetailsTests(unittest.TestCase):
    def test_split_preserves_variants_under_their_feature(self):
        lore, features = split_species('Гном', GNOME)
        self.assertEqual(lore, '<p>Гномы живут в лесах и норах.</p>')
        self.assertEqual(len(features), 3)
        self.assertIn('Создание трёх устройств.', features[2]['data']['desc'])
        self.assertNotIn('Тип существа:', str(features))
        self.assertNotIn('Скорость:', str(features))
        self.assertNotIn('Гномья родословная', features[1]['data']['desc'])

    def test_variant_explains_own_rules_and_preserves_selection_key(self):
        _, features = split_species('Гном', GNOME)
        base = {'size': 'Маленький', 'variants': [{'value': 'Лесной гном', 'label': 'Лесной гном', 'size': 'Маленький'}, {'value': 'Скальный гном', 'label': 'Скальный гном', 'size': 'Маленький'}]}
        result = enrich_species('Гном', base, features)
        self.assertEqual(result['creature_type'], 'Гуманоид')
        forest, rock = result['variants']
        self.assertEqual(forest['value'], 'Лесной гном')
        self.assertIn('3–4', forest['size_description'])
        self.assertIn('Малая иллюзия', forest['description'])
        self.assertNotIn('Создание трёх', forest['description'])
        self.assertIn('Создание трёх', rock['description'])
        self.assertNotIn('Малая иллюзия', rock['description'])
        self.assertNotIn('creature_type', base)

    def test_moves_existing_mechanics_once(self):
        _, features = split_species('Гном', GNOME)
        choices = [{'key': 'casting_ability', 'count': 1}]
        aggregate = {'race_ids': [{'id': 42}], 'choices': choices}
        rows = [feature_data('Гном', feature, aggregate) for feature in features]
        self.assertEqual([row.get('choices') for row in rows], [None, None, choices])
        dwarf = feature_data('Дварф', {'name': 'Дварфийская крепость', 'data': {'level': 1}}, {'race_ids': [{'id': 43}], 'hp_bonuses': [{'per_level': 1}]})
        self.assertEqual(dwarf['hp_bonuses'], [{'per_level': 1}])

    def test_fails_closed_when_source_headings_change(self):
        with self.assertRaises(ValueError):
            split_species('Гном', GNOME.replace('Гномья хитрость.', 'Новая хитрость.'))


if __name__ == '__main__':
    unittest.main()
