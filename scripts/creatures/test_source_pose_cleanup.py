"""Run with isolated Blender --background --factory-startup --python this_file."""
import sys
from pathlib import Path
import unittest

try:
    import bpy
except ImportError:
    raise unittest.SkipTest('Pose tests require isolated Blender')
import numpy as np
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from repair_source_pose import repair_pose


class SourcePoseCleanup(unittest.TestCase):
    def setUp(self):
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        vertices = [(x, y, .2*y+z) for z in [0, .3] for y in [0, 1] for x in [-.2, .2]]
        faces = [(0, 2, 3), (0, 3, 1), (4, 5, 7), (4, 7, 6),
                 (0, 1, 5), (0, 5, 4), (2, 6, 7), (2, 7, 3),
                 (0, 4, 6), (0, 6, 2), (1, 3, 7), (1, 7, 5)]
        vertices += [(-.03, -.3, -.07), (0, -.3, -.06), (.03, -.3, -.05),
                     (2, 2, -3), (2.01, 2, -3), (2, 2.01, -3)]
        faces += [(8, 9, 10), (11, 12, 13)]
        mesh = bpy.data.meshes.new('Measured body, contact tip and debris')
        mesh.from_pydata(vertices, [], faces)
        self.obj = bpy.data.objects.new('Pose test', mesh)
        bpy.context.collection.objects.link(self.obj)
        uv = mesh.uv_layers.new(name='NativeUV')
        for i, loop in enumerate(uv.data):
            loop.uv = (i/len(uv.data), .5)
        material = bpy.data.materials.new('Preserved native paint')
        mesh.materials.append(material)
        self.uv = [tuple(p.uv) for p in uv.data[:39]]
        self.body = np.array(vertices[:8])
        self.settings = dict(sourceUp=[0, -.2, 1], debrisBelow=-1,
                             maxRemovedFaces=1, feetMinimumY=-.05,
                             feetMinimumAbsX=.1, maxLiftDistance=.02,
                             maxLiftVertices=3)

    def test_level_contacts_preserve_body_uvs_and_material(self):
        material = self.obj.data.materials[0]
        report = repair_pose(self.obj, self.settings)
        self.assertEqual(report['removedFaces'], 1)
        self.assertEqual(report['liftedVertices'], 1)
        self.assertEqual(report['selectedFaces'], 1)
        self.assertEqual(len(self.obj.data.polygons), 13)
        self.assertEqual(self.obj.data.materials[0], material)
        self.assertEqual([tuple(p.uv) for p in self.obj.data.uv_layers.active.data], self.uv)
        np.testing.assert_allclose([tuple(v.co) for v in self.obj.data.vertices[:8]], self.body, atol=1e-7)
        transformed = [self.obj.matrix_world @ v.co for v in self.obj.data.vertices]
        self.assertGreaterEqual(min(v.z for v in transformed), -1e-7)
        for i in range(4):
            self.assertAlmostEqual(transformed[i].z, 0, places=6)
        up = self.obj.matrix_world.to_3x3() @ Vector(self.settings['sourceUp']).normalized()
        np.testing.assert_allclose(tuple(up), [0, 0, 1], atol=1e-6)

    def test_failed_guards_do_not_mutate_source(self):
        for patch in [dict(sourceUp=[0, 0, 0]), dict(sourceUp=[0, float('nan'), 1]),
                      dict(maxRemovedFaces=0), dict(maxLiftVertices=0),
                      dict(maxLiftDistance=.001), dict(debrisBelow=.1)]:
            with self.subTest(patch=patch):
                before = [tuple(v.co) for v in self.obj.data.vertices]
                with self.assertRaises(ValueError):
                    repair_pose(self.obj, self.settings | patch)
                self.assertEqual([tuple(v.co) for v in self.obj.data.vertices], before)
                self.assertEqual(len(self.obj.data.polygons), 14)


if __name__ == '__main__':
    result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(SourcePoseCleanup))
    if not result.wasSuccessful():
        raise SystemExit(1)
