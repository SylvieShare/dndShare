import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from miniature_review import require_review
from review_test_support import reviewed_fixture


class ReviewTests(unittest.TestCase):
    def test_blender_review_import_does_not_require_posix_locks(self):
        code = '''
import builtins, sys
sys.path.insert(0, sys.argv[1])
original_import = builtins.__import__
def without_posix_locks(name, *args, **kwargs):
    if name == 'fcntl':
        raise ModuleNotFoundError('fcntl is unavailable in Windows Blender')
    return original_import(name, *args, **kwargs)
builtins.__import__ = without_posix_locks
from miniature_review import placement_context
from model_build_queue import fingerprint
assert fingerprint({'review': True})
'''
        result = subprocess.run([sys.executable, '-I', '-c', code,
                                 str(Path(__file__).resolve().parent)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.folder=Path(self.temp.name)
        self.recipe=reviewed_fixture(self.folder,{'modelId':'wolf','itemId':1692,'referenceDiameter':.9,'materialProfile':'dielectric','calibration':{'sourceDiameter':1,'sourceOrigin':[0,0,0],'rotation':0}})

    def check(self,size=1):
        return require_review(self.folder,self.recipe,size,self.folder/'model-review.json')

    def test_current_acceptance_passes(self): self.assertTrue(self.check()['approved'])

    def test_identical_base_can_be_relocated_without_changing_acceptance(self):
        relocated=self.folder/'restored-base.glb';relocated.write_bytes((self.folder/'base.glb').read_bytes())
        self.recipe['reviewBase']['file']=str(relocated)
        self.assertTrue(self.check()['approved'])

    def test_metadata_changes_require_fresh_placement_even_with_identical_glbs(self):
        for field,value in [('referenceDiameter',.8),('materialProfile','native'),('artProfile','physical'),('supportKind','flight'),('texturePolicy',{'lod':{'basecolor':256}}),('lodBudget',{'maxTriangles':32000,'reason':'Feathers'})]:
            with self.subTest(field=field):
                old=self.recipe.get(field);self.recipe[field]=value
                with self.assertRaisesRegex(ValueError,'Placement preview is stale'):self.check()
                if old is None:self.recipe.pop(field)
                else:self.recipe[field]=old
        self.recipe['calibration']['rotation']=90
        with self.assertRaises(ValueError):self.check()

    def test_new_size_base_or_image_rejects_stale_evidence(self):
        with self.assertRaises(ValueError):self.check(2)
        self.recipe['reviewBase']['surfaceHeight']=.1
        with self.assertRaises(ValueError):self.check()
        self.recipe['reviewBase']['surfaceHeight']=.06
        (self.folder/'base.glb').write_bytes(b'another base')
        with self.assertRaises(ValueError):self.check()

    def test_replacing_a_placement_picture_or_view_rejects_review(self):
        (self.folder/'on-base.png').write_bytes(b'replaced')
        with self.assertRaisesRegex(ValueError,'images changed'):self.check()

    def test_replacing_a_regular_view_rejects_review(self):
        (self.folder/'left.png').write_bytes(b'new view')
        with self.assertRaisesRegex(ValueError,'Art review is missing or stale'):self.check()

    def test_old_approval_or_changed_shadow_does_not_pass(self):
        review=self.folder/'model-review.json';saved=review.read_text()
        review.write_text(json.dumps({'approved':True,'schema':1}))
        with self.assertRaises(ValueError):self.check()
        review.write_text(saved);(self.folder/'model-shadow.glb').write_bytes(b'changed shadow')
        with self.assertRaisesRegex(ValueError,'Art review is missing or stale'):self.check()


if __name__=='__main__':unittest.main()
