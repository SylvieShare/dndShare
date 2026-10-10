"""Native three-pin bases retain the empty spaces under their joining plate."""
import importlib.util
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

path = Path(__file__).with_name('prepare-majestic.py')
spec = importlib.util.spec_from_file_location('prepare_majestic', path)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)
bpy.ops.wm.read_factory_settings(use_empty=True)


def fixture(name):
    vertices, faces = [], []
    for centre_y, half_x, half_y, bottom, top in [
        (0, 17.5, 52.5, 17, 21),
        (-35, 13, 13, 0, 17),
        (0, 13, 13, 0, 17),
        (35, 13, 13, 0, 17),
    ]:
        start = len(vertices)
        vertices += [(x, centre_y+y, z) for z in [bottom, top]
                     for x, y in [(-half_x, -half_y), (half_x, -half_y),
                                  (half_x, half_y), (-half_x, half_y)]]
        faces += [tuple(start+i for i in face) for face in [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
            (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


native = fixture('Native three pins')
positions = np.array([vertex.co[:] for vertex in native.data.vertices])
indices = [tuple(face.vertices) for face in native.data.polygons]
recipe = {'preserveNativeMount': True, 'canStand': False}
pipeline.prepare_mount_geometry(native, 17, recipe)
np.testing.assert_array_equal([vertex.co[:] for vertex in native.data.vertices], positions)
assert [tuple(face.vertices) for face in native.data.polygons] == indices
assert pipeline.mount_objects(native, [0, 0], 17, recipe) == [native]
assert pipeline.support_points(native, [0, 0], recipe, 17) == []
tree = BVHTree.FromObject(native, bpy.context.evaluated_depsgraph_get())
for y in [-35, 0, 35]:
    point, *_ = tree.ray_cast((0, y, -1), (0, 0, 1), 2)
    assert point is not None and abs(point.z) < 1e-6
for y in [-17.5, 17.5]:
    assert tree.ray_cast((0, y, .1), (0, 0, 1), 10)[0] is None

ordinary = fixture('Ordinary cut')
recipe = {'pegBottomHalfMM': 47.03, 'pegTopHalfMM': 48.65}
pipeline.prepare_mount_geometry(ordinary, 18, recipe)
assert min(vertex.co.z for vertex in ordinary.data.vertices) >= 18-1e-6
objects = pipeline.mount_objects(ordinary, [0, 0], 18, recipe)
assert objects[0] is ordinary and len(objects) == 2
assert len(objects[1].data.polygons) == 12
assert min(vertex.co.z for vertex in objects[1].data.vertices) == 0
print('MAJESTIC_NATIVE_MOUNT_VALIDATED three-pins gaps geometry and ordinary-taper', flush=True)
