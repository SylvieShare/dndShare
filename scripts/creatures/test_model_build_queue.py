import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from model_build_queue import BuildQueue, QuotaStop


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = {'schema':1,'entries':[{'slug':'wolf','itemId':1692}],
            'budget':{'maxGenerations':1,'maxGpuCalls':2,'minRemainingGpuSeconds':240,'allowPaidOverquota':False}}
        self.entry = self.manifest['entries'][0]
        self.queue = BuildQueue(self.manifest,self.root)

    def test_resume_skips_completed_stage_and_rebuilds_only_changed_input(self):
        def write():
            path = self.root/'output.glb'; path.write_bytes(b'mesh'); return [path]
        self.assertTrue(self.queue.stage(self.entry,'native',{'seed':1},write))
        resumed = BuildQueue(self.manifest,self.root)
        self.assertFalse(resumed.stage(self.entry,'native',{'seed':1},lambda:self.fail('duplicate generation')))
        self.assertTrue(resumed.stage(self.entry,'native',{'seed':2},write))
        self.assertEqual(resumed.data['jobs']['wolf']['stages']['native']['attempts'],2)
        (self.root/'output.glb').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'output changed'):
            resumed.stage(self.entry,'native',{'seed':2},lambda:self.fail('silent rebuild'))

    def test_failed_stage_retries_and_records_pause_without_secret_text(self):
        def failed(): raise QuotaStop('private diagnostic must not be persisted')
        with self.assertRaises(QuotaStop): self.queue.stage(self.entry,'native',{},failed)
        saved = json.loads(self.queue.path.read_text())
        self.assertEqual(saved['jobs']['wolf']['status'],'paused')
        self.assertNotIn('private diagnostic',self.queue.path.read_text())
        self.assertEqual(self.queue.path.stat().st_mode & 0o777,0o600)
        self.assertEqual(saved['jobs']['wolf']['stages']['native']['errorType'],'QuotaStop')

    def test_quota_and_batch_caps_apply_before_submission(self):
        quota = SimpleNamespace(remaining=239,overquota_used=0,base=2400)
        with self.assertRaises(QuotaStop): self.queue.reserve_gpu(self.entry,'image_to_3d',quota)
        quota.remaining,quota.overquota_used = 1000,1
        with self.assertRaises(QuotaStop): self.queue.reserve_gpu(self.entry,'image_to_3d',quota)
        self.assertEqual(self.queue.data['gpuCalls'],0)
        quota.overquota_used=0
        self.queue.reserve_gpu(self.entry,'image_to_3d',quota)
        with self.assertRaises(QuotaStop): self.queue.reserve_gpu(self.entry,'image_to_3d',quota)
        self.queue.reserve_gpu(self.entry,'extract_glb',quota)
        resumed=BuildQueue(self.manifest,self.root)
        with self.assertRaises(QuotaStop): resumed.reserve_gpu(self.entry,'extract_glb',quota)
        self.assertEqual(resumed.summary()['gpuCalls'],2)
        self.assertEqual(resumed.summary()['generations'],1)

    def test_slug_cannot_escape_workspace_or_change_item(self):
        self.manifest['entries'][0]['slug']='../wolf'
        with self.assertRaises(ValueError): BuildQueue(self.manifest,self.root)
        self.manifest['entries'][0]={'slug':'wolf','itemId':999}
        with self.assertRaises(ValueError): BuildQueue(self.manifest,self.root)


if __name__=='__main__': unittest.main()
