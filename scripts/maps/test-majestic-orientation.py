"""Run with Blender --background --python-exit-code 1 --python this_file."""
import importlib.util
from pathlib import Path
import bpy
import bmesh
from mathutils.bvhtree import BVHTree

spec = importlib.util.spec_from_file_location(
    'prepare_majestic', Path(__file__).with_name('prepare-majestic.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2)
obj = bpy.context.object
vertices = [tuple(v.co) for v in obj.data.vertices]
faces = [tuple(p.vertices) for p in obj.data.polygons]
assert not prepare.orient_outward(obj)
assert faces == [tuple(p.vertices) for p in obj.data.polygons]
mesh = bmesh.new()
mesh.from_mesh(obj.data)
bmesh.ops.reverse_faces(mesh, faces=list(mesh.faces))
mesh.to_mesh(obj.data)
mesh.free()
assert prepare.orient_outward(obj)
assert vertices == [tuple(v.co) for v in obj.data.vertices]
bpy.context.view_layer.update()
tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
point, normal, _, _ = tree.ray_cast((0, 0, 3), (0, 0, -1))
assert point is not None and abs(point.z - 1) < 1e-6 and normal.z > .999
assert not prepare.orient_outward(obj)
print('MAJESTIC_ORIENTATION_TEST_PASSED', flush=True)
