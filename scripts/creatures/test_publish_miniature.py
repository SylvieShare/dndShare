"""Offline checks for replacing assets while preserving the live item/model."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('publish-miniature.py')


class MiniatureUpdate(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.folder = Path(self.temporary.name)
        (self.folder/'publish').mkdir()
        assets = {}
        for role in ['render', 'lod', 'shadow', 'source', 'preview']:
            data = ('new '+role).encode()
            digest = hashlib.sha256(data).hexdigest()
            name = digest+'.glb'
            (self.folder/'publish'/name).write_bytes(data)
            assets[role] = {'key': 'map-models/'+name, 'sha256': digest, 'size': len(data)}
        self.model = {'id': 'model-1', 'hidden': True, 'tileType': 'object',
                      'referenceDiameter': .9, 'maxHeight': .6, 'name': 'Recipe name', 'assets': assets}
        (self.folder/'publish/catalogue.json').write_text(json.dumps([self.model]))
        (self.folder/'verification.json').write_text(json.dumps({'passed': True, 'referenceDiameter': .9, 'originalServiceMeshExported': True, 'assetHashes': {k:v['sha256'] for k,v in assets.items() if k != 'preview'}}))
        self.recipe = self.folder/'recipe.json'
        self.recipe.write_text(json.dumps({'itemId': 2579, 'modelId': 'model-1', 'referenceDiameter': .9}))
        old = copy.deepcopy(assets)
        old['render']['sha256'] = 'previous'
        self.previous = self.folder/'previous.json'
        self.previous.write_text(json.dumps({'verified': True, 'itemId': 2579, 'modelId': 'model-1', 'assets': old}))
        self.remote = dict(self.model, name='Manually edited name', tags=['keep'], assets=old)
        self.bindings = [{'itemId': 2579, 'modelId': 'model-1', 'default': True, 'sortOrder': 7}]
        self.uploads = 0

    def rpc(self, request, **_):
        name = json.loads(request.data)['params']['name']
        self.assertIn(name, ['item_models_list', 'map_tile_model_get'])
        value = self.bindings if name == 'item_models_list' else self.remote
        return io.BytesIO(json.dumps({'result': {'structuredContent': {'result': value}}}).encode())

    def upload(self, command, **_):
        self.assertNotIn('-item-id', command)
        self.uploads += 1
        folder = Path(command[command.index('-assets')+1])
        self.remote = json.loads((folder/'catalogue.json').read_text())[0]

    def run_update(self):
        with patch.object(sys, 'argv', [str(SCRIPT), str(self.folder), str(self.recipe),
                '--publish', '--update-from', str(self.previous)]), \
                patch.dict(os.environ, {'MCP_AUTH_TOKEN': 'offline-test-token'}), \
                patch('urllib.request.urlopen', self.rpc), patch('subprocess.run', self.upload), \
                patch('subprocess.check_output', side_effect=AssertionError('Unexpected SSH')), \
                contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT), run_name='__main__')

    def test_update_preserves_live_metadata_and_bindings_and_retries(self):
        self.run_update()
        self.run_update()
        self.assertEqual(self.uploads, 2)
        self.assertEqual(self.remote['name'], 'Manually edited name')
        self.assertEqual(self.remote['tags'], ['keep'])
        self.assertEqual(self.remote['assets'], self.model['assets'])
        receipt = json.loads((self.folder/'publication.json').read_text())
        self.assertTrue(receipt['verified'])
        self.assertTrue(receipt['originalServiceMeshExported'])
        self.assertEqual(receipt['bindings'], self.bindings)
        for file in self.folder.rglob('*.json'):
            self.assertNotIn('offline-test-token', file.read_text())

    def test_refuses_concurrent_asset_changes(self):
        self.remote['assets']['render']['sha256'] = 'someone-else'
        with self.assertRaisesRegex(AssertionError, 'Model changed'):
            self.run_update()
        self.assertEqual(self.uploads, 0)

    def test_refuses_changing_calibration_as_side_effect_of_asset_update(self):
        self.remote['referenceDiameter'] = .75
        with self.assertRaisesRegex(AssertionError, 'Calibrate changed reference'):
            self.run_update()
        self.assertEqual(self.uploads, 0)

    def test_refuses_an_asset_modified_after_geometry_verification(self):
        asset = self.model['assets']['render']
        data = b'changed after verification'
        digest = hashlib.sha256(data).hexdigest()
        asset.update(key='map-models/'+digest+'.glb', sha256=digest, size=len(data))
        (self.folder/'publish'/Path(asset['key']).name).write_bytes(data)
        (self.folder/'publish/catalogue.json').write_text(json.dumps([self.model]))
        with self.assertRaisesRegex(AssertionError, 'Asset changed since verification'):
            self.run_update()
        self.assertEqual(self.uploads, 0)

    def test_dry_run_never_reads_credentials_or_network(self):
        with patch.object(sys, 'argv', [str(SCRIPT), str(self.folder), str(self.recipe)]), \
                patch('urllib.request.urlopen', side_effect=AssertionError('Network')), \
                patch('subprocess.check_output', side_effect=AssertionError('SSH')), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as result:
            runpy.run_path(str(SCRIPT), run_name='__main__')
        self.assertEqual(result.exception.code, 0)


if __name__ == '__main__':
    unittest.main()
