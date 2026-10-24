"""Silhouette loss, alignment and native GLB transforms, without GPU or models/."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

DEPENDENCIES = all(importlib.util.find_spec(name) for name in ['numpy', 'scipy', 'PIL', 'trimesh'])
if not DEPENDENCIES and os.environ.get('DNDSHARE_TEST_MODELS') == '1':
    raise RuntimeError('Install scripts/creatures/requirements.txt in MODEL_PYTHON')
if DEPENDENCIES:
    import numpy as np
    import trimesh
    from lod_silhouette import accepted, compare, geometry, masks, measure, policy


@unittest.skipUnless(DEPENDENCIES, 'requires miniature Python; mandatory in models profile')
class Silhouettes(unittest.TestCase):
    def test_identical_masks_and_one_pixel_hole_pass(self):
        a = np.zeros((512,512), dtype=bool)
        a[100:400,100:400] = True
        self.assertTrue(accepted(measure(a,a), policy()))
        b = a.copy()
        b[250,250] = False
        metrics = measure(a,b)
        self.assertEqual(metrics['maxDistancePixels'], 1)
        self.assertTrue(accepted(metrics, policy()))

    def test_lost_thin_weapon_fails_even_with_high_global_overlap(self):
        body = np.zeros((512,512), dtype=bool)
        body[100:400,100:400] = True
        armed = body.copy()
        armed[240:242,400:445] = True
        metrics = measure(armed,body)
        self.assertGreater(metrics['iou'], .99)
        self.assertGreater(metrics['maxDistancePixels'], 40)
        self.assertFalse(accepted(metrics, policy()))

    def test_large_internal_hole_and_spurious_geometry_fail(self):
        a = np.zeros((512,512), dtype=bool)
        a[100:400,100:400] = True
        hole = a.copy()
        hole[200:250,200:250] = False
        self.assertFalse(accepted(measure(a,hole), policy()))
        extra = a.copy()
        extra[10:20,10:20] = True
        self.assertFalse(accepted(measure(a,extra), policy()))

    def test_unchanged_geometry_passes_all_views_but_lod_translation_is_not_refitted(self):
        box = trimesh.creation.box(extents=[.4,1,.3])
        reference = (box.vertices,box.faces)
        results, _ = compare(reference,reference,policy())
        self.assertEqual(len(results),17)
        self.assertTrue(all(r['passed'] for r in results))
        shifted = (box.vertices+np.array([.2,0,0]),box.faces)
        a,b,clipped = masks(reference,shifted,0,30,policy())
        self.assertFalse(accepted(measure(a,b,clipped),policy()))

    def test_outside_frame_is_not_silently_clipped_away(self):
        box = trimesh.creation.box(extents=[.4,1,.3])
        reference = (box.vertices,box.faces)
        shifted = (box.vertices+np.array([10,0,0]),box.faces)
        a,b,clipped = masks(reference,shifted,0,0,policy())
        self.assertGreater(clipped,0)
        self.assertFalse(accepted(measure(a,b,clipped),policy()))

    def test_glb_scene_preserves_native_instance_scale_and_translation(self):
        scene = trimesh.Scene()
        transform = np.diag([.04,.02,.03,1.])
        transform[:3,3] = [.3,.02,-.1]
        scene.add_geometry(trimesh.creation.box(),transform=transform)
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp)/'scaled-node.glb'
            scene.export(file)
            vertices,_,sha = geometry(file)
        np.testing.assert_allclose(vertices.min(axis=0), [.28,.01,-.115], atol=1e-6)
        np.testing.assert_allclose(vertices.max(axis=0), [.32,.03,-.085], atol=1e-6)
        self.assertEqual(len(sha),64)

    def test_empty_mask_or_invalid_policy_never_pass(self):
        a = np.zeros((64,64), dtype=bool)
        self.assertFalse(accepted(measure(a,a),policy()))
        for setting in [{'resolution':0},{'padding':1},{'minIoU':float('nan')},{'unknown':1}]:
            with self.assertRaises(ValueError): policy(setting)

    def test_alpha_cards_are_not_misreported_as_opaque_geometry(self):
        box = trimesh.creation.box()
        box.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(alphaMode='MASK'))
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp)/'masked.glb'
            box.export(file)
            with self.assertRaisesRegex(ValueError, 'material-aware'):
                geometry(file)


if __name__ == '__main__':
    unittest.main()
