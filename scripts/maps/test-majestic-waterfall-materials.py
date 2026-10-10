"""Bake a convex water face, wet stone and dry back plane independently."""
import copy
from pathlib import Path
import sys
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_waterfall import apply_waterfall, waterfall_stone_finish, waterfall_stone_orm

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
centres = [(27, 0, 50), (38, 0, 50), (52, 0, 50), (31, -9, 50), (25, -25, 70)]
verts, faces = [], []
for x, y, z in centres:
    start = len(verts)
    verts += [(x+dx, y+dy, z) for dx, dy in [(-.1,-.1),(.1,-.1),(.1,.1),(-.1,.1)]]
    faces.append(tuple(range(start, start+4)))
mesh = bpy.data.meshes.new('Waterfall material fixture')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Waterfall material fixture', mesh)
scene.collection.objects.link(obj)
uv = mesh.uv_layers.new(name='UVMap')
for i, face in enumerate(mesh.polygons):
    centre = (i+.5)/5
    for loop, pair in zip(face.loop_indices, [(centre-.07,.3),(centre+.07,.3),(centre+.07,.7),(centre-.07,.7)]):
        uv.data[loop].uv = pair
positions = np.array([v.co[:] for v in mesh.vertices])
saved_uv = np.array([v.uv[:] for v in uv.data])
recipe = {'waterfall': {
    'profileXZMM': [[38, 10], [38, 90]], 'widthMM': 5.2,
    'frontWidthMM': 14, 'backWidthMM': 4, 'featherMM': .8,
    'minYMM': -26, 'maxYMM': 26, 'minZMM': 13, 'maxZMM': 89,
    'lowerRGB': [.1,.5,.55], 'upperRGB': [.47,.77,.78], 'roughness': .48,
    'rockExclusions': [
        {'centreMM': [31,-9,50], 'radiiMM': [2,3,5], 'rgb': [.435,.45,.395], 'roughness': .82},
        {'centreMM': [25,-25,70], 'radiiMM': [3,3,3]},
    ],
}}
ochre = np.tile([.54,.38,.215], (len(positions),1))
rough = np.full(len(positions), .94)
colours, surfaces = apply_waterfall(positions, ochre.copy(), rough.copy(), recipe)
for indices in [slice(0,4), slice(4,8)]:
    assert np.all(colours[indices,2] > colours[indices,0])
    np.testing.assert_allclose(surfaces[indices], .48)
np.testing.assert_allclose(colours[8:12], ochre[8:12])
np.testing.assert_allclose(colours[16:], ochre[16:])
np.testing.assert_allclose(surfaces[12:16], .82)
assert np.all(np.ptp(colours[12:16], axis=1) < .065)
legacy = copy.deepcopy(recipe)
legacy['waterfall'].pop('frontWidthMM')
legacy['waterfall'].pop('backWidthMM')
legacy['waterfall']['rockExclusions'][0].pop('rgb')
legacy['waterfall']['rockExclusions'][0].pop('roughness')
old, old_rough = apply_waterfall(positions, ochre.copy(), rough.copy(), legacy)
np.testing.assert_allclose(old[:4], ochre[:4])
np.testing.assert_allclose(old[12:16], ochre[12:16])
np.testing.assert_allclose(old_rough[12:16], .94)
paint = mesh.color_attributes.new('Fixture paint', 'FLOAT_COLOR', 'POINT')
colours[12:16] = [.1,.5,.55]
linear = np.where(colours <= .04045, colours/12.92, ((colours+.055)/1.055)**2.4)
paint.data.foreach_set('color', np.column_stack([linear, np.ones(len(linear))]).astype(np.float32).ravel())
mat = bpy.data.materials.new('Waterfall paint verification')
mat.use_nodes = True
mesh.materials.append(mat)
nodes, links = mat.node_tree.nodes, mat.node_tree.links
colour = nodes.new('ShaderNodeVertexColor')
colour.layer_name = 'Fixture paint'
assert waterfall_stone_finish(nodes, links, colour, legacy) is colour
recipe['waterfall']['perPixelRocks'] = True
finish = waterfall_stone_finish(nodes, links, colour, recipe)
emit = nodes.new('ShaderNodeEmission')
links.new(finish.outputs[0], emit.inputs['Color'])
links.new(emit.outputs[0], nodes.get('Material Output').inputs['Surface'])
im = bpy.data.images.new('Waterfall colour check', width=160, height=32, is_data=True, float_buffer=True)
tex = nodes.new('ShaderNodeTexImage')
tex.image = im
nodes.active = tex
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type='EMIT', margin=1)
pixels = np.array(im.pixels[:]).reshape(32,160,4)
for x in [16,48]:
    assert pixels[16,x,2] > pixels[16,x,0]
for x in [80,144]:
    assert pixels[16,x,0] > pixels[16,x,2]
assert abs(pixels[16,112,0]-pixels[16,112,1]) < .04
surface = nodes.new('ShaderNodeCombineColor')
surface.inputs['Green'].default_value = .48
combine = nodes.new('ShaderNodeCombineColor')
separate = nodes.new('ShaderNodeSeparateColor')
links.new(surface.outputs[0], separate.inputs[0])
links.new(separate.outputs['Green'], combine.inputs['Green'])
waterfall_stone_orm(nodes, links, combine, separate)
links.new(combine.outputs[0], emit.inputs['Color'])
bpy.ops.object.bake(type='EMIT', margin=1)
orm_pixels = np.array(im.pixels[:]).reshape(32,160,4)
assert orm_pixels[16,112,1] > .8
assert abs(orm_pixels[16,48,1]-.48) < .01
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]), positions)
np.testing.assert_array_equal(np.array([v.uv[:] for v in uv.data]), saved_uv)
print('MAJESTIC_WATERFALL_MATERIALS_VALIDATED', pixels[16,[16,48,80,112,144],:3].tolist(), flush=True)
