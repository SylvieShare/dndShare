"""Numerical CLI check: independently budgeted meshes and deterministic LOD rebuilds."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

DEPENDENCIES = all(importlib.util.find_spec(n) for n in ['numpy', 'trimesh', 'xatlas', 'fast_simplification'])
if not DEPENDENCIES and os.environ.get('DNDSHARE_TEST_MODELS') == '1':
    raise RuntimeError('Install scripts/creatures/requirements.txt in MODEL_PYTHON')
if DEPENDENCIES:
    import numpy as np
    import trimesh


@unittest.skipUnless(DEPENDENCIES, 'requires miniature Python; mandatory in models profile')
class NativeGeometry(unittest.TestCase):
    def test_simple_volume_stays_cheap_and_lod_can_be_rebuilt_independently(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            native = trimesh.creation.icosphere(subdivisions=3)
            native.apply_scale([.4, .6, .3])
            native.apply_translation([.1, .2, -.1])
            source = root / 'source.glb'
            native.export(source)
            command = [sys.executable, str(Path(__file__).with_name('prepare-native-geometry.py')), str(root),
                       '--source', str(source), '--render-triangles', '800', '--lod-triangles', '400',
                       '--shadow-triangles', '100', '--shadow-aggression', '7']
            subprocess.run(command, check=True, capture_output=True)
            files = {r: root / f'geometry-{r}.glb' for r in ['render', 'lod', 'shadow']}
            before = {r: f.read_bytes() for r, f in files.items()}
            old_lod = trimesh.load(files['lod'], force='mesh')
            report = json.loads((root / 'geometry-report.json').read_text())
            for role, limit in [('render', 800), ('lod', 400), ('shadow', 100)]:
                mesh = trimesh.load(files[role], force='mesh')
                self.assertGreater(len(mesh.faces), 0)
                self.assertLessEqual(len(mesh.faces), limit)
                self.assertEqual(report['roles'][role]['actualTriangles'], len(mesh.faces))
                self.assertAlmostEqual(mesh.bounds[0, 1], native.bounds[0, 1], places=6)
                if role != 'shadow':
                    self.assertTrue(np.isfinite(mesh.visual.uv).all())
            files['lod'].unlink()
            subprocess.run(command + ['--only', 'lod'], check=True, capture_output=True)
            self.assertEqual(files['render'].read_bytes(), before['render'])
            self.assertEqual(files['shadow'].read_bytes(), before['shadow'])
            lod = trimesh.load(files['lod'], force='mesh')
            np.testing.assert_allclose(lod.vertices, old_lod.vertices)
            np.testing.assert_array_equal(lod.faces, old_lod.faces)
            # Swallowed interior detail should not increase a solid body's shadow.
            inside=trimesh.creation.icosphere(subdivisions=3,radius=.1)
            inside.apply_translation(native.centroid)
            trimesh.util.concatenate([native,inside]).export(source)
            subprocess.run(command+['--only','shadow','--shadow-hull'],check=True,capture_output=True)
            shadow=trimesh.load(files['shadow'],force='mesh')
            shadow.merge_vertices()
            self.assertEqual(len(shadow.split(only_watertight=False)),1)
            self.assertLessEqual(len(shadow.faces),100)
            self.assertTrue(json.loads((root/'geometry-report.json').read_text())['shadowHull'])



if __name__ == '__main__':
    unittest.main()
