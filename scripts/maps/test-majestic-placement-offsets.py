"""A measured point inside a cell can use a surviving bridge stub instead of the lower floor."""
import importlib.util
from pathlib import Path
import bpy
import numpy as np


spec = importlib.util.spec_from_file_location('majestic_prepare', Path(__file__).with_name('prepare-majestic.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
bpy.ops.wm.read_factory_settings(use_empty=True)
vertices = [(-60, -60, 15), (60, -60, 15), (60, 60, 15), (-60, 60, 15),
            (40, -8, 25), (50, -8, 25), (50, 8, 25), (40, 8, 25)]
mesh = bpy.data.meshes.new('Floor and surviving stub')
mesh.from_pydata(vertices, [], [(0, 1, 2, 3), (4, 5, 6, 7)]); mesh.update()
obj = bpy.data.objects.new('Floor and surviving stub', mesh)
bpy.context.scene.collection.objects.link(obj); bpy.context.view_layer.update()
before = np.array([v.co[:] for v in mesh.vertices])
recipe = {'width': 3, 'height': 3, 'standMaxZMM': 30}
ordinary = module.support_points(obj, [0, 0], recipe, 9.75)
shifted = module.support_points(obj, [0, 0], {**recipe, 'placementPointOffsetsMM': {'2,1': [10, 5]}}, 9.75)
assert len(ordinary) == len(shifted) == 9
assert ordinary[5]['elevation'] == round(15/35, 6)
assert shifted[5] == {'x': round(2.5+10/35, 6), 'y': round(1.5-5/35, 6), 'elevation': round(25/35, 6)}
assert ordinary[:5] == shifted[:5] and ordinary[6:] == shifted[6:]
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]), before)
try:
    module.support_points(obj, [0, 0], {**recipe, 'placementPointOffsetsMM': {'2,1': [18, 0]}}, 9.75)
except ValueError:
    pass
else:
    raise AssertionError('Offset outside the original cell must be rejected')
print('MAJESTIC_PLACEMENT_OFFSETS_VALIDATED', shifted[5], flush=True)
