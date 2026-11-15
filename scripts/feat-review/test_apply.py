import copy
import importlib.util
from pathlib import Path
import unittest

module_spec = importlib.util.spec_from_file_location('feat_apply', Path(__file__).with_name('apply.py'))
apply = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(apply)


class ReviewPublication(unittest.TestCase):
    def setUp(self):
        self.item = {'id': 1, 'typeId': 7, 'name': 'Щит', 'data': {'description': 'old'},
                     'compatibility': [{'sourceVersionId': 1, 'status': 'native'}]}
        self.spec = {'id': 1, 'editionId': 1,
                     'fields': {'description': {'before': 'old', 'after': 'new'}}}

    def test_preserves_unrelated_concurrent_fields_and_is_idempotent(self):
        self.item['data']['new_rule'] = {'value': 3}
        self.item['iconImageId'] = 99
        result = apply.proposed(self.item, self.spec)
        self.assertEqual(result['data'], {'description': 'new', 'new_rule': {'value': 3}})
        self.assertEqual(result['iconImageId'], 99)
        self.assertEqual(apply.proposed(result, self.spec), result)
        self.assertEqual(self.item['data']['description'], 'old')

    def test_rejects_conflicting_edit_wrong_edition_and_personal_item(self):
        for patch in [{'data': {'description': 'someone else'}}, {'userId': 4},
                      {'compatibility': [{'sourceVersionId': 2, 'status': 'native'}]}]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                apply.proposed({**self.item, **patch}, self.spec)

    def test_verifies_unmodified_sources_media_and_rules(self):
        self.item.update(iconImageId=99, contentSourceIds=[42])
        for key, value in [('iconImageId', 100), ('contentSourceIds', []), ('data', {})]:
            edited = copy.deepcopy(self.item)
            edited[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                apply.verify(edited, self.item)


if __name__ == '__main__':
    unittest.main()
