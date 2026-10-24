"""Calibration changes metadata only, preserves bindings, and refuses stale input."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('calibrate-miniatures.py')


class Calibration(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name)
        self.plan = self.folder/'plan.json'
        self.plan.write_text(json.dumps([{'modelId': 'body', 'sourceCode': 'CRE-1', 'referenceDiameter': .9}]))
        self.model = {'id': 'body', 'sourceCode': 'CRE-1', 'tileType': 'object',
                      'name': 'Keep me', 'assets': {'render': {'sha256': 'unchanged'}}}
        self.bindings = [{'itemId': 1, 'modelId': 'body'}]
        self.writes = 0
        self.reads = 0

    def rpc(self, request, **_):
        self.reads += 1
        params = json.loads(request.data)['params']
        name = params['name']
        if name == 'map_tile_model_get':
            value = self.model
        elif name == 'item_models_list':
            value = self.bindings
        elif name == 'map_tile_model_register':
            self.writes += 1
            self.model = copy.deepcopy(params['arguments']['model'])
            value = self.model
        else:
            raise AssertionError(name)
        return io.BytesIO(json.dumps({'result': {'structuredContent': {'result': value}}}).encode())

    def run_mode(self, *flags):
        with patch.object(sys, 'argv', [str(SCRIPT), str(self.plan), str(self.folder), *flags]), \
                patch.dict(os.environ, {'MCP_AUTH_TOKEN': 'offline-token'}), \
                patch('urllib.request.urlopen', self.rpc), \
                patch('subprocess.check_output', side_effect=AssertionError('Unexpected SSH')), \
                contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT), run_name='__main__')

    def test_only_diameter_changes_and_retry_is_idempotent(self):
        before = copy.deepcopy(self.model)
        self.run_mode('--snapshot')
        self.run_mode('--apply')
        self.run_mode('--apply')
        self.assertEqual(self.writes, 1)
        self.assertEqual(self.model, dict(before, referenceDiameter=.9))
        receipt = json.loads((self.folder/'publication.json').read_text())
        self.assertTrue(receipt['verified'])
        self.assertEqual(receipt['bindings'], self.bindings)
        self.assertNotIn('offline-token', (self.folder/'publication.json').read_text())

    def test_stale_metadata_or_bindings_stops_before_writes(self):
        self.run_mode('--snapshot')
        self.model['name'] = 'Concurrent edit'
        with self.assertRaisesRegex(AssertionError, 'Model changed'):
            self.run_mode('--apply')
        self.assertEqual(self.writes, 0)

    def test_dry_run_never_connects(self):
        self.run_mode()
        self.assertEqual(self.reads, 0)
        self.assertEqual(self.writes, 0)

    def test_stale_bindings_stop_before_writes(self):
        self.run_mode('--snapshot')
        self.bindings.append({'itemId': 2, 'modelId': 'another-model'})
        with self.assertRaisesRegex(AssertionError, 'Bindings changed'):
            self.run_mode('--apply')
        self.assertEqual(self.writes, 0)


if __name__ == '__main__':
    unittest.main()
