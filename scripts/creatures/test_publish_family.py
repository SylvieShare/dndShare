"""Offline regressions for updating reviewed assets without changing item bindings."""
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

SCRIPT = Path(__file__).with_name('publish-family.py')
RECIPES = json.loads(SCRIPT.with_name('kobold-family.json').read_text())


class UpdatePublication(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.folder = Path(self.temporary.name)
        publish = self.folder/'publish'
        publish.mkdir()
        self.models = []
        earlier = []
        for recipe in RECIPES:
            assets = {}
            for role in ['render','lod','shadow','source','preview']:
                data = (recipe['slug']+role).encode()
                sha = hashlib.sha256(data).hexdigest()
                name = sha+'.glb'
                (publish/name).write_bytes(data)
                assets[role] = {'key':'map-models/'+name, 'sha256':sha,
                    'size':len(data), 'mimeType':'model/gltf-binary', 'fileName':role+'.glb'}
            model = {'id':recipe['modelId'], 'name':'Generated name', 'hidden':True,
                'tileType':'object', 'maxHeight':1.1, 'assets':assets}
            self.models.append(model)
            old = copy.deepcopy(assets)
            old['render']['sha256'] = 'old-render'
            earlier.append({'modelId':model['id'],'assets':old})
        (publish/'catalogue.json').write_text(json.dumps(self.models))
        self.previous = self.folder/'previous.json'
        self.previous.write_text(json.dumps({'verified':True,'models':earlier}))
        self.remote = dict(copy.deepcopy(self.models[0]),
            name='Manually edited name', groupName='Manual group', tags=['keep-me'],
            definitionId='stable-definition', maxHeight=.9, assets=earlier[0]['assets'])
        self.bindings = [
            {'itemId':1635,'modelId':'existing-kobold','default':True,'sortOrder':0},
            {'itemId':1636,'modelId':self.remote['id'],'default':True,'sortOrder':3},
            {'itemId':1672,'modelId':'existing-guard','default':True,'sortOrder':1},
        ]
        self.calls = []
        self.uploads = 0

    def rpc(self, request, **_):
        payload = json.loads(request.data)
        name = payload['params']['name']
        self.calls.append(name)
        self.assertIn(name, ['item_models_list','map_tile_model_get'])
        result = self.bindings if name == 'item_models_list' else self.remote
        return io.BytesIO(json.dumps({'result':{'structuredContent':{'result':result}}}).encode())

    def upload(self, command, **_):
        self.uploads += 1
        directory = Path(command[command.index('-assets')+1])
        models = json.loads((directory/'catalogue.json').read_text())
        self.assertEqual(len(models), 1)
        self.remote = models[0]

    def run_update(self):
        arguments = [str(SCRIPT),str(self.folder),'--publish','--only','icewind',
            '--update-from',str(self.previous)]
        with patch.object(sys,'argv',arguments), \
                patch.dict(os.environ,{'MCP_AUTH_TOKEN':'local-test-token'}), \
                patch('urllib.request.urlopen',self.rpc), \
                patch('subprocess.run',self.upload), \
                patch('subprocess.check_output',side_effect=AssertionError('Unexpected SSH')), \
                contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT),run_name='__main__')

    def test_update_preserves_metadata_and_bindings_and_can_be_retried(self):
        before = copy.deepcopy(self.remote)
        self.run_update()
        self.assertEqual(self.remote['assets'],self.models[0]['assets'])
        self.assertEqual(self.remote['maxHeight'],1.1)
        for key in ['name','groupName','tags','definitionId']:
            self.assertEqual(self.remote[key],before[key])
        receipt = json.loads((self.folder/'update-publication.json').read_text())
        self.assertTrue(receipt['verified'])
        self.assertEqual(receipt['newModels'],0)
        self.assertEqual(receipt['updatedModels'],1)
        self.assertEqual(receipt['bindings'],self.bindings)
        self.assertNotIn('item_model_bind',self.calls)
        self.run_update()
        self.assertEqual(self.uploads,2)

    def test_changed_remote_version_is_rejected_before_upload(self):
        self.remote['assets']['render']['sha256'] = 'someone-elses-version'
        with self.assertRaisesRegex(AssertionError,'Remote assets changed'):
            self.run_update()
        self.assertEqual(self.uploads,0)
        self.assertFalse((self.folder/'update-publication.json').exists())

    def test_custom_default_binding_is_preserved(self):
        self.bindings[1]['default'] = False
        self.bindings.append({'itemId':1636,'modelId':'custom-preferred-model',
            'default':True,'sortOrder':0})
        before = copy.deepcopy(self.bindings)
        self.run_update()
        receipt = json.loads((self.folder/'update-publication.json').read_text())
        self.assertEqual(receipt['bindings'],before)
        self.assertNotIn('item_model_bind',self.calls)

    def test_changed_local_file_is_rejected_before_rpc(self):
        name = Path(self.models[0]['assets']['render']['key']).name
        (self.folder/'publish'/name).write_bytes(b'tampered')
        with self.assertRaisesRegex(AssertionError,'Asset size mismatch'):
            self.run_update()
        self.assertEqual(self.calls,[])
        self.assertEqual(self.uploads,0)


if __name__ == '__main__':
    unittest.main()
