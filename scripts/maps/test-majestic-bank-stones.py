"""Wet bank stone stays grey beside small waves and protected grass."""
import copy
from pathlib import Path
import sys
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_water import apply_water

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
verts, faces = [], []
for y, z, half in [(35,14.4,.6), (33,13.8,.05), (40,16,.05), (41,14.4,.6)]:
    start = len(verts)
    verts += [(-39+dx,y+dy,z) for dx,dy in [(-half,-half),(half,-half),(half,half),(-half,half)]]
    faces.append(tuple(range(start,start+4)))
mesh = bpy.data.meshes.new('Bank materials')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Bank materials', mesh)
scene.collection.objects.link(obj)
positions = np.array([v.co[:] for v in mesh.vertices])
uv = mesh.uv_layers.new(name='UVMap')
for i, face in enumerate(mesh.polygons):
    centre = (i+.5)/4
    for loop, pair in zip(face.loop_indices, [(centre-.1,.3),(centre+.1,.3),(centre+.1,.7),(centre-.1,.7)]):
        uv.data[loop].uv = pair
saved_uv = np.array([v.uv[:] for v in uv.data])
recipe = {'water': {
    'reference':'MH-111', 'matchMM':.06, 'blendMM':.16,
    'minZMM':10.05, 'lowZMM':11.5, 'highZMM':14.5,
    'boundsMM':[[-54,-54,10],[54,54,14.8]],
    'deepRGB':[.035,.28,.33], 'shallowRGB':[.14,.56,.58], 'crestRGB':[.52,.78,.74],
    'roughness':.4,
    'lowWaterDomain':{'pointsMM':[[-50,20],[-20,20],[-20,44],[-50,44]], 'maxZMM':14.8, 'featherMM':.5},
    'plantKeepBoxes':[{'minMM':[-41,34,14],'maxMM':[-37,42,17],'featherMM':.2}],
    'bankStoneSurfaces':[{'boundsMM':[[-42,30,13.3],[-35,42,17.5]], 'normalXMax':1,'minAreaMM2':.15,'growAngleRad':.2,
                         'pointsMM':[[-42,30],[-35,30],[-35,37],[-42,37]]}],
}}
green = np.tile([.31,.43,.12], (len(positions),1))
green[12:] = [.45,.3,.17]
rough = np.full(len(positions), .94)
legacy = copy.deepcopy(recipe)
legacy['water'].pop('bankStoneSurfaces')
old, _ = apply_water(obj, positions, green.copy(), rough.copy(), legacy)
np.testing.assert_allclose(old[:4], green[:4])
colours, surfaces = apply_water(obj, positions, green.copy(), rough.copy(), recipe)
np.testing.assert_allclose(colours[:4], np.tile([.415,.435,.39],(4,1)))
np.testing.assert_allclose(surfaces[:4], .88)
assert np.all(colours[4:8,2] > colours[4:8,0])
np.testing.assert_allclose(surfaces[4:8], .4)
np.testing.assert_allclose(colours[8:], green[8:])
np.testing.assert_allclose(surfaces[8:], .94)
rectangle = copy.deepcopy(recipe)
rectangle['water']['bankStoneSurfaces'][0].pop('pointsMM')
rect_colours, rect_surfaces = apply_water(obj, positions, green.copy(), rough.copy(), rectangle)
np.testing.assert_allclose(rect_colours[:12], colours[:12])
np.testing.assert_allclose(rect_surfaces[:12], surfaces[:12])
np.testing.assert_allclose(rect_colours[12:], np.tile([.415,.435,.39],(4,1)))
paint = mesh.color_attributes.new('Fixture paint','FLOAT_COLOR','POINT')
linear = np.where(colours <= .04045, colours/12.92, ((colours+.055)/1.055)**2.4)
paint.data.foreach_set('color', np.column_stack([linear,np.ones(len(linear))]).astype(np.float32).ravel())
mat = bpy.data.materials.new('Bank verification')
mat.use_nodes = True
mesh.materials.append(mat)
nodes, links = mat.node_tree.nodes, mat.node_tree.links
colour = nodes.new('ShaderNodeVertexColor')
colour.layer_name = 'Fixture paint'
emit = nodes.new('ShaderNodeEmission')
links.new(colour.outputs['Color'], emit.inputs['Color'])
links.new(emit.outputs[0], nodes.get('Material Output').inputs['Surface'])
im = bpy.data.images.new('Bank colour check',width=128,height=32,is_data=True,float_buffer=True)
tex = nodes.new('ShaderNodeTexImage')
tex.image = im
nodes.active = tex
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type='EMIT',margin=1)
pixels = np.array(im.pixels[:]).reshape(32,128,4)
assert np.ptp(pixels[16,16,:3]) < .04
assert pixels[16,48,2] > pixels[16,48,0]
assert pixels[16,80,1] > pixels[16,80,0] > pixels[16,80,2]
assert pixels[16,112,0] > pixels[16,112,1] > pixels[16,112,2]
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]),positions)
np.testing.assert_array_equal(np.array([v.uv[:] for v in uv.data]),saved_uv)
print('MAJESTIC_BANK_STONES_VALIDATED',pixels[16,[16,48,80,112],:3].tolist(),flush=True)
