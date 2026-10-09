"""Bake independent gray/ochre regions; a custom palette must preserve the surrounding material."""
import copy
from pathlib import Path
import sys
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_masonry import masonry_box_finish


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
vertices, faces = [], []
for x, y, z in [(-2, 0, 1), (2, 0, 1), (0, 3, .5)]:
    offset = len(vertices)
    vertices += [(x+dx, y+dy, z) for dx, dy in [(-.3, -.3), (.3, -.3), (.3, .3), (-.3, .3)]]
    faces.append(tuple(range(offset, offset+4)))
mesh = bpy.data.meshes.new('Palette regions')
mesh.from_pydata(vertices, [], faces); mesh.update()
obj = bpy.data.objects.new('Palette regions', mesh)
scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
uv = mesh.uv_layers.new(name='UVMap')
for face, centre in zip(mesh.polygons, [.2, .5, .8]):
    for index, pair in zip(face.loop_indices, [(centre-.08, .42), (centre+.08, .42), (centre+.08, .58), (centre-.08, .58)]):
        uv.data[index].uv = pair
recipe = {'masonryRGB': [.54, .38, .215], 'masonrySurfaceBoxes': [
    {'minMM': [-3, -1, 0], 'maxMM': [-1, 1, 2]},
    {'minMM': [1, -1, 0], 'maxMM': [3, 1, 2]},
]}
before_positions = np.array([v.co[:] for v in mesh.vertices])
before_uv = np.array([v.uv[:] for v in uv.data])


def bake(settings):
    mat = bpy.data.materials.new('Measured palettes'); mat.use_nodes = True
    mesh.materials.clear(); mesh.materials.append(mat)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    base = nodes.new('ShaderNodeRGB'); base.outputs[0].default_value = (.02, .12, .01, 1)
    white = nodes.new('ShaderNodeRGB'); white.outputs[0].default_value = (1, 1, 1, 1)
    finish = masonry_box_finish(nodes, links, base, settings, white.outputs[0], white.outputs[0])
    emit = nodes.new('ShaderNodeEmission'); links.new(finish.outputs[0], emit.inputs['Color'])
    links.new(emit.outputs[0], nodes.get('Material Output').inputs['Surface'])
    image = bpy.data.images.new('Palette bake', width=64, height=64, is_data=True, float_buffer=True)
    target = nodes.new('ShaderNodeTexImage'); target.image = image; nodes.active = target
    bpy.ops.object.bake(type='EMIT', margin=1)
    pixels = np.array(image.pixels[:]).reshape(64, 64, 4)
    return np.array([pixels[32, int(centre*64), :3] for centre in [.2, .5, .8]])


legacy = bake(recipe)
custom = copy.deepcopy(recipe)
custom['masonrySurfaceBoxes'][1]['rgb'] = [.47, .445, .39]
result = bake(custom)
linear = lambda rgb: np.where(np.array(rgb) <= .04045, np.array(rgb)/12.92, ((np.array(rgb)+.055)/1.055)**2.4)
np.testing.assert_allclose(legacy[:2], [linear(recipe['masonryRGB'])]*2, atol=2e-4)
np.testing.assert_allclose(result[0], legacy[0], atol=1e-6)
np.testing.assert_allclose(result[1], linear(custom['masonrySurfaceBoxes'][1]['rgb']), atol=2e-4)
np.testing.assert_allclose(result[2], [.02, .12, .01], atol=2e-4)
np.testing.assert_array_equal(result[2], legacy[2])
np.testing.assert_array_equal(np.array([v.co[:] for v in mesh.vertices]), before_positions)
np.testing.assert_array_equal(np.array([v.uv[:] for v in uv.data]), before_uv)
print('MAJESTIC_MASONRY_PALETTES_VALIDATED', result.tolist(), flush=True)
