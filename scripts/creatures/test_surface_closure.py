import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    import numpy as np
    import trimesh
    import scipy
    import skimage
    AVAILABLE = True
except ImportError:
    AVAILABLE = False


@unittest.skipUnless(AVAILABLE,'Numerical model runtime required')
class SurfaceClosureTests(unittest.TestCase):
    def test_closes_a_small_opening_without_moving_the_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); source=root/'source.glb'; target=root/'closed.glb'
            mesh=trimesh.creation.icosphere(subdivisions=3,radius=.15)
            mesh.apply_translation((.2,.1,-.3))
            mask=np.ones(len(mesh.faces),dtype=bool); mask[15]=False; mesh.update_faces(mask)
            self.assertFalse(mesh.is_watertight)
            mesh.export(source); original=source.read_bytes()
            command=[sys.executable,str(Path(__file__).with_name('close-native-surface.py')),str(source),str(target),'--pitch','.003','--radius','4']
            subprocess.run(command,check=True,capture_output=True)
            result=trimesh.load(target,force='mesh')
            self.assertTrue(result.is_watertight)
            self.assertGreater(result.volume,.012)
            self.assertLess(np.max(np.abs(result.bounds-mesh.bounds)),.006)
            outward=np.einsum('ij,ij->i',result.vertex_normals,result.vertices-np.array([.2,.1,-.3]))
            self.assertGreater(np.percentile(outward,5),0)
            self.assertEqual(source.read_bytes(),original)
            self.assertTrue(json.loads(target.with_suffix('.json').read_text())['watertight'])
            command[-3]='.000001'
            failed=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(failed.returncode,0)
            self.assertIn('memory budget',failed.stderr)


if __name__=='__main__': unittest.main()
