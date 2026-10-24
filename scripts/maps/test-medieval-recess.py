"""Functional stairwell regression, without an external STL fixture."""
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).parent))
from medieval_recess import assert_no_recess, prepare_recess, pin_recess, verify_recess_collapse
from recess_triangulation import triangulate_recess

bpy.ops.wm.read_factory_settings(use_empty=True)
vertices = [(sx*r, sy*r, z) for r, z in [(11.375, 0), (17.15, 17)]
            for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
faces = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7)]
for i in range(4):
    j = (i+1) % 4
    faces.extend([(i, j, j+4), (i, j+4, i+4)])
mesh = bpy.data.meshes.new('Native taper')
mesh.from_pydata(vertices, [], faces)
source = bpy.data.objects.new('Synthetic native tile', mesh)
bpy.context.collection.objects.link(source)


def cube(name, lo, hi):
    bpy.ops.mesh.primitive_cube_add(size=2, location=tuple((a+c)/2 for a, c in zip(lo, hi)))
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple((c-a)/2 for a, c in zip(lo, hi))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    return obj


def boolean(operand, operation):
    bpy.context.view_layer.update()
    mod = source.modifiers.new(operation, 'BOOLEAN')
    mod.object, mod.operation, mod.solver = operand, operation, 'MANIFOLD'
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(operand, do_unlink=True)


boolean(cube('Native upper floor', [-17.5, -17.5, 17], [17.5, 17.5, 26]), 'UNION')
recipe = dict(width=1, height=1, mountCenterMM=[0, 0], mountDepthMM=17,
              plainMountCollarMM=0, recessMount=dict(probeHalfMM=16, envelopeTriangles=2000, hiddenWallMM=1))
assert_no_recess(source, recipe)
boolean(cube('Deep native well', [-8, -8, 9], [8, 8, 27]), 'DIFFERENCE')
bm = bmesh.new()
bm.from_mesh(source.data)
triangulate_recess(bm)
bm.to_mesh(source.data)
bm.free()
source.data.update()
try:
    assert_no_recess(source, recipe)
except ValueError as error:
    assert 'recess' in str(error)
else:
    raise AssertionError('Ordinary cropping accepted a visible native recess')
# A roof hides the well from the sky while leaving it accessible from inside.
boolean(cube('Wall supporting the roof', [-17.5, -17.5, 25], [-15, 17.5, 39]), 'UNION')
boolean(cube('Roof above the native well', [-17.5, -17.5, 38], [17.5, 17.5, 40]), 'UNION')
try:
    prepare_recess(source, recipe, 'a'*64)
except ValueError as error:
    assert 'visible surfaces below' in str(error)
else:
    raise AssertionError('A covered well unexpectedly passed sky-only probing')
recipe['surfaceHeightMM'] = 26
recipe['recessMount']['probeTopMM'] = 26
try:
    prepare_recess(source, recipe, 'a'*64)
except ValueError as error:
    assert 'above the measured rim' in str(error)
else:
    raise AssertionError('A probe starting inside the rim was accepted')
recipe['recessMount']['probeTopMM'] = 29
body, aux, protected, proof = prepare_recess(source, recipe, 'a'*64)
assert proof['maximumCavityDeviationMM'] < .001
assert proof['maximumUpperDeviationMM'] < .001
assert proof['cavityProbesMM']
assert all(abs(p[2]-9) < .001 for p in proof['cavityProbesMM']), 'Probe started inside solid wall boarding'
assert proof['cavityProbeTopMM'] == 29
for obj in aux:
    obj.hide_viewport = False
bpy.context.view_layer.update()
heights = []
for obj in [body]+aux:
    hit = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get()).ray_cast((0, 0, 29), (0, 0, -1))
    if hit[0] is not None:
        heights.append(hit[0].z)
assert abs(max(heights)-9) < .001, 'New insertion covered the native floor'
roof_hit = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get()).ray_cast((0, 0, 50), (0, 0, -1))
assert roof_hit[0] is not None and abs(roof_hit[0].z-40) < .001, 'Recess construction changed the roof'
group, boundary = pin_recess(body, protected)
bpy.context.view_layer.objects.active = body
mod = body.modifiers.new('Interface regression', 'DECIMATE')
mod.ratio = .7
mod.vertex_group = group
mod.vertex_group_factor = 1
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
verify_recess_collapse(body, boundary)
print('MEDIEVAL_RECESS_REGRESSION_PASS', flush=True)
