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
    @staticmethod
    def front_hit(mesh, yz):
        """Furthest +X hit, computed independently from projected triangles."""
        triangles=mesh.triangles
        a=triangles[:,0,1:]; b=triangles[:,1,1:]-a; c=triangles[:,2,1:]-a
        determinant=b[:,0]*c[:,1]-b[:,1]*c[:,0]
        valid=np.abs(determinant)>1e-12
        triangles,a,b,c,determinant=[v[valid] for v in [triangles,a,b,c,determinant]]
        delta=np.asarray(yz)-a
        u=(delta[:,0]*c[:,1]-delta[:,1]*c[:,0])/determinant
        v=(b[:,0]*delta[:,1]-b[:,1]*delta[:,0])/determinant
        inside=(u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)
        return np.max((triangles[:,0,0]*(1-u-v)+triangles[:,1,0]*u+triangles[:,2,0]*v)[inside])

    def test_surface_cap_fills_cloth_without_reshaping_the_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.glb';target=root/'cap.glb'
            mesh=trimesh.creation.box(extents=(.3,.3,.3)).subdivide().subdivide().subdivide()
            centres=mesh.triangles_center;candidates=np.where(centres[:,0]>.149)[0]
            opening=candidates[np.linalg.norm(centres[candidates,1:],axis=1).argmin()]
            ray=centres[opening,1:].copy();rim=mesh.triangles[opening].copy()
            keep=np.ones(len(mesh.faces),dtype=bool);keep[opening]=False;mesh.update_faces(keep)
            mesh.export(source);original=source.read_bytes();authored=trimesh.load(source,force='mesh')
            self.assertLess(self.front_hit(authored,ray),0)
            command=[sys.executable,str(Path(__file__).with_name('close-native-surface.py')),str(source),str(target),
                '--cap-rim',*map(str,rim.reshape(-1)),'--cap-normal','1','0','0']
            subprocess.run(command,check=True,capture_output=True)
            repaired=trimesh.load(target,force='mesh')
            self.assertGreater(self.front_hit(repaired,ray),.15)
            self.assertLess(self.front_hit(repaired,ray),.151)
            for vertex in authored.vertices:
                self.assertLess(np.linalg.norm(repaired.vertices-vertex,axis=1).min(),1e-7)
            report=json.loads(target.with_suffix('.json').read_text())
            self.assertEqual(report['method'],'surface-cap')
            self.assertTrue(report['preservedSourceGeometry'])
            self.assertEqual(report['replacementFaces'],12)
            self.assertTrue(report['capWatertight'])
            self.assertEqual(source.read_bytes(),original)
            command[-3:]=['0','0','0']
            failed=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(failed.returncode,0)
            self.assertIn('outward normal',failed.stderr)
            angles=np.arange(5)*2*np.pi/5
            star=np.column_stack([np.full(5,.15),.01*np.cos(angles),.01*np.sin(angles)])[[0,2,4,1,3]]
            failed=subprocess.run(command[:4]+['--cap-rim',*map(str,star.reshape(-1)),
                '--cap-normal','1','0','0'],capture_output=True,text=True)
            self.assertNotEqual(failed.returncode,0)
            self.assertIn('ordered loop',failed.stderr)

    def test_local_patch_seals_opening_and_preserves_distant_anatomy(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.glb';target=root/'local.glb'
            mesh=trimesh.creation.box(extents=(.3,.3,.3)).subdivide().subdivide().subdivide()
            centres=mesh.triangles_center
            candidates=np.where(centres[:,0]>.149)[0]
            opening=candidates[np.linalg.norm(centres[candidates,1:],axis=1).argmin()]
            ray=centres[opening,1:].copy()
            keep=np.ones(len(mesh.faces),dtype=bool);keep[opening]=False;mesh.update_faces(keep)
            mesh.export(source);original=source.read_bytes()
            authored=trimesh.load(source,force='mesh')
            self.assertLess(self.front_hit(authored,ray),0)
            region=[.12,-.06,-.06,.18,.06,.06]
            command=[sys.executable,str(Path(__file__).with_name('close-native-surface.py')),
                str(source),str(target),'--pitch','.004','--radius','4','--region',*map(str,region)]
            subprocess.run(command,check=True,capture_output=True)
            repaired=trimesh.load(target,force='mesh')
            self.assertGreater(self.front_hit(repaired,ray),.14)
            distant=authored.vertices[authored.vertices[:,0]<-.14]
            for vertex in distant:
                self.assertLess(np.linalg.norm(repaired.vertices-vertex,axis=1).min(),1e-7)
            report=json.loads(target.with_suffix('.json').read_text())
            self.assertTrue(report['preservedOutsideRegion'])
            self.assertEqual(report['region'],region)
            self.assertGreater(report['replacementFaces'],0)
            self.assertEqual(source.read_bytes(),original)
            command[-6:]=['0']*6
            failed=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(failed.returncode,0)
            self.assertIn('finite ordered bounds',failed.stderr)

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
