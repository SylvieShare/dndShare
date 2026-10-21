"""Measured detail triangles survive reduction of the surrounding surface."""
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from medieval_geometry_details import pin_details, verify_details

bpy.ops.wm.read_factory_settings(use_empty=True)
points = [(x/4, y/4, .4*math.exp(-(x*x+y*y)/4))
          for y in range(-16, 17) for x in range(-16, 17)]
faces = []
for y in range(32):
    for x in range(32):
        i = y*33+x
        faces.extend([(i, i+1, i+34), (i, i+34, i+33)])
mesh = bpy.data.meshes.new('Sculpted detail grid')
mesh.from_pydata(points, [], faces)
mesh.update()
obj = bpy.data.objects.new('Measured detail fixture', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
base = obj.vertex_groups.new(name='Existing collapse restrictions')
base.add(list(range(1, len(points))), 1, 'REPLACE')
corner = tuple(mesh.vertices[0].co)
region = dict(name='Small raised detail', minMM=[-.9, -.9, -.1], maxMM=[.9, .9, 1])
try:
    pin_details(obj, [region], 'Missing base restrictions')
except ValueError:
    pass
else:
    raise AssertionError('Missing base restrictions silently replaced')
name, before, review = pin_details(obj, [region], base.name)
assert name == base.name and review['protectedTriangles'] > 20
mod = obj.modifiers.new('Reduce the rest', 'DECIMATE')
mod.ratio, mod.use_collapse_triangulate = .15, True
mod.vertex_group, mod.vertex_group_factor = name, 1
bpy.ops.object.modifier_apply(modifier=mod.name)
proof = verify_details(obj, before, review)
assert proof['preservedTriangles'] == len(before)
assert len(obj.data.polygons) < len(faces)*.5
assert any(tuple(v.co) == corner for v in obj.data.vertices), 'Existing protected vertex moved'
try:
    pin_details(obj, [{**region, 'minMM': [float('nan'), -1, -1]}])
except ValueError:
    pass
else:
    raise AssertionError('Invalid detail bounds accepted')
protected_points = {p for triangle in before for p in triangle}
vertex = next(v for v in obj.data.vertices if tuple(v.co) in protected_points)
vertex.co.x += .01
try:
    verify_details(obj, before, review)
except ValueError:
    pass
else:
    raise AssertionError('Changed detail triangle passed verification')
print('MEASURED_GEOMETRY_DETAILS_PASS', proof, flush=True)
