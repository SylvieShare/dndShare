import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from publish import current_target, publish, request_for
from record_batches import identity


class MediaPublicationContract(unittest.TestCase):
    def test_item_type_fallback_never_counts_as_item_art(self):
        self.assertNotEqual(identity({'kind':'item_type','id':34}), identity({'kind':'item','id':34}))
        self.assertEqual(identity({'kind':'item','id':7550,'typeId':20},True), ('item',7550))
        self.assertNotEqual(identity({'kind':'suggest','typeId':34,'id':1}), identity({'kind':'suggest','typeId':35,'id':1}))

    def test_dictionary_scope_and_independent_slot(self):
        asset = {'target': {'kind': 'suggest', 'typeId': 34, 'id': 1, 'name': 'Интеллект'},
                 'slot': 'icon', 'final': 'int.webp', 'mimeType': 'image/webp'}
        with patch('publish.get', return_value={'items': [{'id': 16}]}):
            with self.assertRaisesRegex(ValueError, 'another system'):
                current_target(asset, 3)
        name, args = request_for(asset, b'test')
        self.assertEqual(name, 'handbook_suggest_set_system_image')
        self.assertTrue(args['preservePrevious'])
        self.assertEqual(args['id'], 1)
        asset['slot'] = 'cover'
        name,args=request_for(asset,b'test')
        self.assertEqual(name,'handbook_suggest_set_system_image')
        self.assertEqual(args['slot'],'cover')

    def test_unreviewed_art_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'batch.json'
            file.write_text(json.dumps({'assets': [{'key': 'unreviewed'}]}))
            with self.assertRaisesRegex(ValueError, 'Visual review'):
                publish(file)

    def test_base_record_ownership_is_checked(self):
        asset = {'target': {'kind': 'item', 'id': 10, 'name': 'Киберрука'}}
        with patch('publish.get', side_effect=[{'items': [{'id': 10, 'name': 'Киберрука', 'typeId': 26, 'userId': 1}]}, {'types': [{'id': 26}]}]):
            with self.assertRaisesRegex(ValueError, 'base RED'):
                current_target(asset, 3)


if __name__ == '__main__':
    unittest.main()
