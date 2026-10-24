import contextlib
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
from model_build_queue import file_hash
from production_archives import NativeArchiveStop

SCRIPT=Path(__file__).with_name('production-queue.py')


class NativeBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.events=[];self.credential_reads=0
        entries=[{'slug':slug,'itemId':i,'height':1,'size':1,'lodTriangles':12000} for slug,i in [('wolf',1692),('boar',1745)]]
        manifest={'schema':1,'entries':entries,'budget':{'maxGenerations':2,'maxGpuCalls':4,'minRemainingGpuSeconds':240,'allowPaidOverquota':False}}
        self.manifest=self.root/'manifest.json';self.manifest.write_text(json.dumps(manifest))
        for entry in entries:
            folder=self.root/entry['slug'];folder.mkdir();ref=folder/'miniature-reference.png';ref.write_bytes(b'reference')
            (folder/'reference-review.json').write_text(json.dumps({'approved':True,'imageSHA256':file_hash(ref)}))
            (folder/'recipe.json').write_text(json.dumps({'itemId':entry['itemId'],'modelId':entry['slug']}))
        self.script=runpy.run_path(str(SCRIPT))

    def generate(self,cp,reference,remote):
        folder=reference.parent;self.events.append('generate:'+folder.name)
        out=folder/'trellis-native';(out/'generated-original.glb').write_bytes(b'mesh');(out/'generation.json').write_text('{}')

    def pack(self,folder,stage):
        self.events.append('pack:'+folder.name)
        out=folder/'archives';out.mkdir(exist_ok=True)
        file=out/'native.tar.gz';file.write_bytes(b'archive');descriptor=out/'native-archive.json';descriptor.write_text('{}')
        return file,descriptor

    def upload(self,folder,stage,mcp):
        self.events.append('upload:'+folder.name)
        if self.fail_upload:raise RuntimeError('storage unavailable')
        path=folder/'archives/native-publication.json';path.write_text('{"verified":true}');return path

    def run_queue(self,fail=False,until='native'):
        self.fail_upload=fail
        def credential(_):self.credential_reads+=1;return 'offline-test'
        self.script['main'].__globals__['WORKFLOW']=self.generate
        with patch.object(sys,'argv',[str(SCRIPT),str(self.manifest),'--workdir',str(self.root),'--run','--until',until,'--server-token']), \
            patch('production_archives.archive_inputs',side_effect=lambda folder,stage:{'native':folder/'trellis-native/generated-original.glb'}), \
            patch('production_archives.pack_archive',side_effect=self.pack),patch('production_archives.publish_archive',side_effect=self.upload), \
            patch('production_archives.configured_token',side_effect=credential),contextlib.redirect_stdout(io.StringIO()):
            return self.script['main']()

    def test_native_is_backed_up_before_next_model_and_resume_is_cached(self):
        self.assertEqual(self.run_queue(),0)
        self.assertEqual(self.events,['generate:wolf','pack:wolf','upload:wolf','generate:boar','pack:boar','upload:boar'])
        self.events=[]
        self.assertEqual(self.run_queue(),0)
        self.assertEqual(self.credential_reads,1)
        self.assertEqual(self.events,[])

    def test_failed_backup_stops_batch_and_resumes_without_regeneration(self):
        with self.assertRaises(NativeArchiveStop):self.run_queue(fail=True)
        self.assertEqual(self.events,['generate:wolf','pack:wolf','upload:wolf'])
        self.events=[];self.assertEqual(self.run_queue(),0)
        self.assertEqual(self.events,['upload:wolf','generate:boar','pack:boar','upload:boar'])

    def test_historical_ready_stage_cannot_bypass_a_new_review_or_failure(self):
        self.assertEqual(self.run_queue(),0)
        path=self.root/'production-state.json';state=json.loads(path.read_text())
        for job in state['jobs'].values():job['stages']['ready']={'status':'complete'}
        path.write_text(json.dumps(state))
        with patch('production_stages.process',return_value=None):self.assertEqual(self.run_queue(until='ready'),1)
        with patch('production_stages.process',side_effect=ValueError('stale review')):self.assertEqual(self.run_queue(until='ready'),1)


if __name__=='__main__':unittest.main()
