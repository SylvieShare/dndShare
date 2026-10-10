"""Bake a translated height field: grass follows the sampled sculpt, not clamped edges."""
from pathlib import Path
import sys
import tempfile
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_grass import paint
from majestic_surface import sample_field

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
field = np.zeros((211, 211), np.float32)
field[:] = np.linspace(20, 30, 211)[:, None]
verts, faces = [], []
for y in [202, 208]:
    start = len(verts)
    verts += [(105+dx, y+dy, 22) for dx, dy in [(-.05,-.05),(.05,-.05),(.05,.05),(-.05,.05)]]
    faces.append(tuple(range(start, start+4)))
mesh = bpy.data.meshes.new('Translated field fixture')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Translated field fixture', mesh)
scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
uv = mesh.uv_layers.new(name='UVMap')
for face, centre in zip(mesh.polygons, [.25, .75]):
    for index, pair in zip(face.loop_indices, [(centre-.1,.4),(centre+.1,.4),(centre+.1,.6),(centre-.1,.6)]):
        uv.data[index].uv = pair
positions = np.array([v.co[:] for v in mesh.vertices])
saved_uv = np.array([v.uv[:] for v in uv.data])
bounds = [[100,200],[110,210]]
np.testing.assert_allclose(sample_field(field, np.array([[105,202,22],[105,208,22]]), bounds), [22,28])
np.testing.assert_array_equal(sample_field(field, positions), np.full(8, 30))
# Verify the default mapping still samples the original [-52.5,52.5] field.
np.testing.assert_allclose(sample_field(field, np.array([[0,0,0]])), [25])
base = Path(__file__).resolve().parents[2]/'models/collections/majestic-highlands/survey'
base.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='field-bounds-test-', dir=base) as directory:
    np.save(Path(directory)/'top-surface.npy', field[:,:,None])
    recipe = {'soilTopRGB':[.3,.32,.34], 'soilTopStartMM':0,
              'soilDomains':[[[99,199],[111,199],[111,211],[99,211]]],
              'soilDomainFeatherMM':.1, 'soilSurfaceMM':30, 'grassHeightFadeMM':1,
              'raisedGrass':{'minMM':[100,200,15], 'maxMM':[110,210,30],
                             'depthMM':1.6, 'depthFadeMM':.5, 'normalMin':.4,
                             'normalFade':.25, 'fieldCode':Path(directory).name, 'fieldBoundsMM':bounds}}
    paint(obj, recipe, 'fixture')
mat = bpy.data.materials.new('Field bounds colour check')
mat.use_nodes = True
mesh.materials.append(mat)
nodes, links = mat.node_tree.nodes, mat.node_tree.links
colour = nodes.new('ShaderNodeVertexColor')
colour.layer_name = 'Paint'
emit = nodes.new('ShaderNodeEmission')
links.new(colour.outputs['Color'], emit.inputs['Color'])
links.new(emit.outputs[0], nodes.get('Material Output').inputs['Surface'])
im = bpy.data.images.new('Field bounds bake', width=64, height=64, is_data=True, float_buffer=True)
tex = nodes.new('ShaderNodeTexImage')
tex.image = im
nodes.active = tex
bpy.ops.object.bake(type='EMIT', margin=1)
pixels = np.array(im.pixels[:]).reshape(64,64,4)
assert pixels[32,16,1] > pixels[32,16,0] and pixels[32,16,1] > 2*pixels[32,16,2]
assert pixels[32,48,2] > pixels[32,48,1] > pixels[32,48,0]
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]), positions)
np.testing.assert_array_equal(np.array([v.uv[:] for v in uv.data]), saved_uv)
for bad in [[[1,1],[1,2]], [[0,0],[float('nan'),2]]]:
    try:
        sample_field(field, positions, bad)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid field bounds accepted')
print('MAJESTIC_FIELD_BOUNDS_VALIDATED', pixels[32,[16,48],:3].tolist(), flush=True)
