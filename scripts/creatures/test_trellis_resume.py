"""Fault injection at submission, result collection, extraction and download."""
import copy
import contextlib
import io
import json
from pathlib import Path
import runpy
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

from trellis_checkpoint import Checkpoint, TerminalJobError, atomic_write, output_lock
from trellis_transport import events, TrellisRemote, validate_glb

SCRIPT = runpy.run_path(str(Path(__file__).with_name('generate-trellis.py')))
WORKFLOW = SCRIPT['workflow']
JSON_CHUNK = b'{"asset":{"version":"2.0"}}  '
GLB = struct.pack('<4sIIII', b'glTF', 2, 20+len(JSON_CHUNK), len(JSON_CHUNK), 0x4e4f534a)+JSON_CHUNK


class Remote:
    def __init__(self):
        self.submissions, self.collected = [], []
        self.download_fail = self.collect_fail = self.quota = self.unknown = self.expired = False

    def submit(self, name, arguments):
        self.submissions.append(name)
        if name == 'image_to_3d' and self.unknown:
            raise ConnectionError('lost submission response')
        return str(len(self.submissions))

    def result(self, name, event_id):
        self.collected.append((name, event_id))
        if name == 'image_to_3d' and self.collect_fail:
            self.collect_fail = False
            raise ConnectionError('lost event stream')
        if name == 'extract_glb' and self.quota:
            self.quota = False
            raise TerminalJobError('quota')
        if name == 'extract_glb' and self.expired:
            raise TerminalJobError('session-unavailable')
        return {'start_session': [], 'preprocess_image': [{'path': '/image.png'}],
                'image_to_3d': ['<html>accepted preview</html>'], 'extract_glb': [{'path': '/model.glb'}]}[name]

    def upload(self, image):
        return {'path': '/uploaded.png'}

    def download(self, reference, target, glb=False):
        if glb and self.download_fail:
            self.download_fail = False
            raise ConnectionError('download interrupted')
        atomic_write(target, GLB if glb else b'processed PNG')

    def close(self):
        pass


class Resume(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.image = self.folder/'input.png'
        self.image.write_bytes(b'original PNG')
        self.identity = {'imageSHA256': 'image', 'settings': {'seed': 1, 'resolution': '512',
                         'decimationTarget': 300000, 'textureSize': 2048}}
        self.remote = Remote()

    def run_workflow(self, views_only=False):
        return WORKFLOW(Checkpoint(self.folder, self.identity), self.image, lambda _: self.remote, views_only)

    def test_completed_output_needs_no_network_or_authentication(self):
        self.run_workflow()
        result = WORKFLOW(Checkpoint(self.folder, self.identity), self.image,
                          lambda _: self.fail('Unexpected remote client'))
        self.assertTrue(result['originalMeshExported'])
        self.assertEqual(len(self.remote.submissions), 4)
        self.assertEqual((self.folder/'generated-original.glb').read_bytes(), GLB)

    def test_collection_resumes_original_event_without_duplicate_generation(self):
        self.remote.collect_fail = True
        with self.assertRaises(ConnectionError): self.run_workflow()
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'), 1)
        attempts = [event for name, event in self.remote.collected if name == 'image_to_3d']
        self.assertEqual(attempts, [attempts[0]]*2)

    def test_quota_retries_extraction_only(self):
        self.remote.quota = True
        with self.assertRaises(TerminalJobError): self.run_workflow()
        checkpoint = Checkpoint(self.folder, self.identity)
        self.assertEqual(checkpoint.data['steps']['extract_glb']['errorKind'], 'quota')
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'), 1)
        self.assertEqual(self.remote.submissions.count('extract_glb'), 2)

    def test_download_resumes_without_new_extraction(self):
        self.remote.download_fail = True
        with self.assertRaises(ConnectionError): self.run_workflow()
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('extract_glb'), 1)

    def test_views_only_can_continue_to_native_export(self):
        self.assertFalse(self.run_workflow(True)['originalMeshExported'])
        result = WORKFLOW(Checkpoint(self.folder, self.identity), self.image,
                          lambda _: self.fail('Views already local'), True)
        self.assertFalse(result['originalMeshExported'])
        self.assertTrue(self.run_workflow()['originalMeshExported'])
        self.assertEqual(self.remote.submissions.count('image_to_3d'), 1)

    def test_unknown_submission_and_expired_state_do_not_start_new_gpu_jobs(self):
        self.remote.unknown = True
        with self.assertRaises(ConnectionError): self.run_workflow()
        with self.assertRaisesRegex(RuntimeError, 'outcome unknown'): self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'), 1)

    def test_expired_session_stops_repeated_extraction(self):
        self.remote.expired = True
        with self.assertRaises(TerminalJobError): self.run_workflow()
        with self.assertRaisesRegex(RuntimeError, 'session expired'): self.run_workflow()
        self.assertEqual(self.remote.submissions.count('extract_glb'), 1)

    def test_input_changes_and_corrupt_files_are_rejected(self):
        self.run_workflow()
        changed = copy.deepcopy(self.identity)
        changed['settings']['seed'] = 2
        with self.assertRaises(ValueError): Checkpoint(self.folder, changed)
        (self.folder/'generated-original.glb').write_bytes(b'broken')
        with self.assertRaisesRegex(ValueError, 'missing or changed'): self.run_workflow()

    def test_receipt_is_private_and_lock_prevents_parallel_generations(self):
        self.run_workflow()
        cp = Checkpoint(self.folder, self.identity)
        self.assertNotIn(cp.data['sessionHash'], json.dumps(cp.status()))
        self.assertEqual(cp.path.stat().st_mode & 0o777, 0o600)
        with output_lock(self.folder):
            with self.assertRaisesRegex(RuntimeError, 'Another process'):
                with output_lock(self.folder): pass

    def test_result_receipt_recovers_a_crash_before_checkpoint_advance(self):
        save = Checkpoint.save
        def interrupted(checkpoint):
            if checkpoint.data['steps'].get('image_to_3d',{}).get('status') == 'complete':
                raise OSError('crash after result receipt')
            save(checkpoint)
        with patch.object(Checkpoint, 'save', interrupted):
            with self.assertRaises(OSError): self.run_workflow()
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'),1)
        self.assertEqual(sum(n == 'image_to_3d' for n,_ in self.remote.collected),1)

    def test_known_rejected_request_can_retry_without_unknown_submission(self):
        original = self.remote.submit
        def rejected(name, arguments):
            if name == 'image_to_3d': raise TerminalJobError('request-rejected')
            return original(name, arguments)
        with patch.object(self.remote, 'submit', rejected):
            with self.assertRaises(TerminalJobError): self.run_workflow()
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'),1)

    def test_status_is_read_only_and_works_while_generator_owns_the_lock(self):
        self.run_workflow(True)
        before = (self.folder/'trellis-checkpoint.json').read_bytes()
        output = io.StringIO()
        with output_lock(self.folder), patch.object(sys,'argv',['generate-trellis.py','missing-input.png',str(self.folder),'--status','--token-stdin']), contextlib.redirect_stdout(output):
            SCRIPT['main']()
        self.assertEqual(json.loads(output.getvalue())['steps']['image_to_3d']['status'],'complete')
        self.assertEqual((self.folder/'trellis-checkpoint.json').read_bytes(),before)

    def test_local_validation_failure_does_not_mark_an_unsent_job_as_unknown(self):
        def validate(name, arguments):
            if name == 'image_to_3d': raise ValueError('bad API contract')
        self.remote.payload = validate
        with self.assertRaises(ValueError): self.run_workflow()
        self.assertNotIn('image_to_3d', Checkpoint(self.folder).data['steps'])
        del self.remote.payload
        self.run_workflow()
        self.assertEqual(self.remote.submissions.count('image_to_3d'),1)


class Protocol(unittest.TestCase):
    def remote(self):
        remote = object.__new__(TrellisRemote)
        remote.session_hash, remote.timeout = 'private-session',30
        remote.components = {1:'state',2:'slider',3:'slider',4:'html'}
        remote.dependencies = {'extract_glb':{'id':9,'inputs':[1,2,3],'outputs':[2,3]},
                               'image_to_3d':{'outputs':[1,4]}}
        return remote

    def test_hidden_state_input_is_inserted_without_sending_latents(self):
        remote = self.remote()
        remote.info = {'/extract_glb':{'parameters':[
            {'parameter_name':'decimation_target'},
            {'parameter_name':'texture_size','parameter_has_default':True,'parameter_default':2048}]}}
        class Response:
            status_code = 200
            def raise_for_status(self): pass
            def json(self): return {'event_id':'existing-job'}
        calls = []
        class Client:
            def post(self, url, json): calls.append(json); return Response()
        remote.client = Client()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(remote.submit('extract_glb',{'decimation_target':300000}),'existing-job')
        self.assertEqual(calls,[{'data':[None,300000,2048],'fn_index':9,'session_hash':'private-session'}])

    def test_result_filters_other_events_and_hidden_state_output(self):
        remote = self.remote()
        class Response:
            status_code = 200
            def raise_for_status(self): pass
            def iter_lines(self):
                messages = [{'msg':'heartbeat'},
                    {'msg':'process_completed','event_id':'other','success':True,'output':{'data':[]}},
                    {'msg':'process_completed','event_id':'wanted','success':True,'output':{'data':[None,'<html>preview</html>']}}]
                for message in messages:
                    yield 'data: '+json.dumps(message)
                    yield ''
        class Client:
            def stream(self,*args,**kwargs): return contextlib.nullcontext(Response())
        remote.client = Client()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(remote.result('image_to_3d','wanted'),['<html>preview</html>'])

    def test_gradio_queue_events_can_span_multiple_data_lines(self):
        data = list(events(['data: {"event_id":"old",', 'data: "msg":"heartbeat"}', '',
                            'data: {"msg":"process_completed","success":true}', '']))
        self.assertEqual(len(data), 2)
        self.assertEqual(data[1][1]['msg'], 'process_completed')

    def test_file_reference_cannot_send_credentials_to_foreign_origin(self):
        remote = object.__new__(TrellisRemote)
        self.assertIn('/gradio_api/file=', remote.file_url({'path': '/tmp/model.glb'}))
        with self.assertRaises(ValueError):
            remote.file_url({'path': '/tmp/a', 'url': 'https://example.com/gradio_api/file=/a'})

    def test_partial_or_wrong_glb_is_not_accepted(self):
        validate_glb(GLB)
        for data in [b'not glb', GLB[:-1], b'xxxx'+GLB[4:]]:
            with self.assertRaises(ValueError): validate_glb(data)


if __name__ == '__main__':
    unittest.main()
