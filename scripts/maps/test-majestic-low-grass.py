"""A grass tuft inside a cliff region stays green; adjacent broad stone stays ochre."""
import copy
from pathlib import Path
import sys
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_surface import low_grass_weights
from majestic_masonry import apply_masonry

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
verts, faces = [], []
for x, half in [(20, .05), (24, .6)]:
    offset = len(verts)
    verts += [(x+dx, -20+dy, 19) for dx, dy in [(-half,-half),(half,-half),(half,half),(-half,half)]]
    faces.append(tuple(range(offset, offset+4)))
mesh = bpy.data.meshes.new('Low grass beside rock'); mesh.from_pydata(verts, [], faces); mesh.update()
obj = bpy.data.objects.new('Low grass beside rock', mesh); scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
uv = mesh.uv_layers.new(name='UVMap')
for face, centre in zip(mesh.polygons, [.25,.75]):
    for i, pair in zip(face.loop_indices, [(centre-.1,.4),(centre+.1,.4),(centre+.1,.6),(centre-.1,.6)]): uv.data[i].uv=pair
positions = np.array([v.co[:] for v in mesh.vertices]); saved_uv = np.array([v.uv[:] for v in uv.data])
recipe = {
    'masonryReference': {'code':'MH-002','rotateZ':270,'matchMM':.06,'blendMM':.2},
    'masonryRGB':[.54,.38,.215], 'masonryRegion': {'u':[-100,100],'v':[-100,100],'minZMM':17},
    'masonryOverrides':[{'u':[-100,100],'v':[-100,100],'z':[17,23]}],
    'lowGrassAreas':[{'minMM':[18,-23,15.2],'maxMM':[27,-13,23]}],
    'lowGrassStoneSurface':{'boundsMM':[[18,-23,15.2],[27,-13,23]],'normalXMax':1,'minAreaMM2':.25,'growAngleRad':.2},
}
mask = low_grass_weights(obj, positions, recipe)
np.testing.assert_allclose(mask[:4], 1); np.testing.assert_allclose(mask[4:], 0)
attr=mesh.color_attributes.new('LowGrass','FLOAT_COLOR','POINT')
attr.data.foreach_set('color',np.column_stack([mask]*3+[np.ones(len(mask))]).astype(np.float32).ravel())
green=np.tile([.31,.43,.12],(len(positions),1)); rough=np.full(len(positions),.94)
legacy=copy.deepcopy(recipe);legacy.pop('lowGrassAreas');legacy.pop('lowGrassStoneSurface')
old,_=apply_masonry(obj,positions,green.copy(),rough.copy(),legacy)
colours,_=apply_masonry(obj,positions,green.copy(),rough.copy(),recipe)
np.testing.assert_allclose(colours[:4],green[:4],atol=1e-6)
np.testing.assert_allclose(colours[4:],old[4:],atol=1e-6)
assert np.all(old[:,0]>old[:,1])
paint=mesh.color_attributes.new('Fixture paint','FLOAT_COLOR','POINT')
linear=np.where(colours<=.04045,colours/12.92,((colours+.055)/1.055)**2.4)
paint.data.foreach_set('color',np.column_stack([linear,np.ones(len(linear))]).astype(np.float32).ravel())
mat=bpy.data.materials.new('Paint verification');mat.use_nodes=True;mesh.materials.append(mat)
nodes,links=mat.node_tree.nodes,mat.node_tree.links
colour=nodes.new('ShaderNodeVertexColor');colour.layer_name='Fixture paint'
emit=nodes.new('ShaderNodeEmission');links.new(colour.outputs['Color'],emit.inputs['Color']);links.new(emit.outputs[0],nodes.get('Material Output').inputs['Surface'])
im=bpy.data.images.new('Colour check',width=64,height=64,is_data=True,float_buffer=True)
tex=nodes.new('ShaderNodeTexImage');tex.image=im;nodes.active=tex
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); bpy.context.view_layer.objects.active=obj
bpy.ops.object.bake(type='EMIT',margin=1)
pixels=np.array(im.pixels[:]).reshape(64,64,4)
assert pixels[32,16,1]>pixels[32,16,0]
assert pixels[32,48,0]>pixels[32,48,1]
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]),positions)
np.testing.assert_array_equal(np.array([v.uv[:] for v in uv.data]),saved_uv)
local = copy.deepcopy(recipe)
local['lowGrassAreas'].append({
    'minMM':[23,-23,18], 'maxMM':[25,-17,20],
    'stoneSurface': {'boundsMM':[[23,-23,18],[25,-17,20]],
                     'normalXMax':1, 'minAreaMM2':2, 'growAngleRad':.2},
})
local_mask = low_grass_weights(obj, positions, local)
np.testing.assert_allclose(local_mask, 1)
local['lowGrassAreas'][-1]['stoneSurface']['minAreaMM2'] = .25
np.testing.assert_allclose(low_grass_weights(obj, positions, local), mask)
print('MAJESTIC_LOW_GRASS_VALIDATED',pixels[32,[16,48],:3].tolist(),flush=True)
