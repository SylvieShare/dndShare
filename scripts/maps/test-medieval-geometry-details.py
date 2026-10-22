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

# The mounting cut can leave quads; pinning must retain their surface and paint.
mesh = bpy.data.meshes.new('Cut mounting rim')
mesh.from_pydata([(0, 0, 17), (1, 0, 17), (1, 1, 17.4), (0, 1, 17.4)], [], [(0, 1, 2, 3)])
mesh.update()
paint = mesh.color_attributes.new(name='Paint', type='FLOAT_COLOR', domain='POINT')
colours = [(0.2 + i*.1, 0.3, 0.4, 1) for i in range(4)]
for i, colour in enumerate(colours): paint.data[i].color = colour
obj = bpy.data.objects.new('Cut mounting rim fixture', mesh)
bpy.context.collection.objects.link(obj)
original = {tuple(v.co): tuple(paint.data[v.index].color) for v in mesh.vertices}
_, before, review = pin_details(obj, [dict(name='Rim', minMM=[-.1, -.1, 16.9], maxMM=[1.1, 1.1, 17.5])])
assert len(mesh.polygons) == 2 and all(len(f.vertices) == 3 for f in mesh.polygons)
assert abs(sum(f.area for f in mesh.polygons) - (1 + .4**2)**.5) < 1e-5
assert {tuple(v.co): tuple(mesh.color_attributes['Paint'].data[v.index].color) for v in mesh.vertices} == original
assert verify_details(obj, before, review)['preservedTriangles'] == 2
print('CUT_MOUNTING_RIM_TRIANGULATION_PASS', flush=True)
