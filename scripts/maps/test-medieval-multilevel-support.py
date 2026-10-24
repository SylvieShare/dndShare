"""Blender integration: two actual floors at identical XY retain both heights."""
from pathlib import Path
import importlib.util
import bpy

script = Path(__file__).with_name('prepare-medieval.py')
spec = importlib.util.spec_from_file_location('medieval_multilevel_pipeline', script)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)
bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('two physical floors')
vertices = [(x, y, z) for z in [25, 100]
            for x, y in [(-17.5, -17.5), (17.5, -17.5), (17.5, 17.5), (-17.5, 17.5)]]
mesh.from_pydata(vertices, [], [(0, 1, 2, 3), (4, 5, 6, 7)])
mesh.update()
obj = bpy.data.objects.new('two physical floors', mesh)
bpy.context.scene.collection.objects.link(obj)
bpy.context.view_layer.update()
recipe = {'width': 1, 'height': 1, 'mountCenterMM': [0, 0], 'mountDepthMM': 17,
          'standPointsMM': [[0, 0], [0, 0]], 'placementCells': [[0, 0], [0, 0]],
          'standRayTopsMM': [40, 140]}
points = pipeline.support_points(obj, recipe)
assert [p['elevation'] for p in points] == [round(25/35, 6), round(100/35, 6)]
assert all(p['cell'] == {'x': 0, 'y': 0} and p['x'] == p['y'] == .5 for p in points)
try:
    pipeline.support_points(obj, {**recipe, 'standRayTopsMM': [40, 20]})
except ValueError:
    pass
else:
    raise AssertionError('A ray below its supporting floor must not create a standing point')
print('MEDIEVAL_MULTILEVEL_SUPPORT_CONFIRMED', points, flush=True)
