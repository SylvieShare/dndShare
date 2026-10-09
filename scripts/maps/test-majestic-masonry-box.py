"""Blender integration: bake stone inside the measured area, retain grass outside."""
from pathlib import Path
import sys
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from majestic_masonry import masonry_box_finish


def bake_patch(vertices, expected_stone):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = bpy.data.meshes.new('Measured tread')
    mesh.from_pydata(vertices, [], [(0,1,2,3)]); mesh.update()
    obj = bpy.data.objects.new('Measured tread', mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    uv = mesh.uv_layers.new()
    for i, point in enumerate([(0,0),(1,0),(1,1),(0,1)]): uv.data[i].uv = point
    original = [tuple(v.co) for v in mesh.vertices]
    mat = bpy.data.materials.new('Tread test'); mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    white = nodes.new('ShaderNodeRGB'); white.outputs[0].default_value = (1,1,1,1)
    finish = nodes.new('ShaderNodeMixRGB'); finish.inputs[0].default_value = 0
    finish.inputs[1].default_value = (.1,.4,.05,1)
    assert masonry_box_finish(nodes, links, finish, {}, white.outputs[0], white.outputs[0]) is finish
    recipe = {'masonryRGB':[.62,.46,.27], 'masonrySurfaceBoxes':[
        {'minMM':[24,4,54.5], 'maxMM':[42,13,57.5], 'normalZMin':.85}]}
    finish = masonry_box_finish(nodes, links, finish, recipe, white.outputs[0], white.outputs[0])
    links.new(finish.outputs[0], shader.inputs['Base Color']); mesh.materials.append(mat)
    image = bpy.data.images.new('Baked tread', width=16, height=16)
    target = nodes.new('ShaderNodeTexImage'); target.image = image; nodes.active = target
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=False,
                        margin=0, use_clear=True)
    pixel = np.array(image.pixels[:]).reshape(16,16,4)[8,8]
    if expected_stone: assert pixel[0] > pixel[1]*1.2, f'Stone became grass: {pixel}'
    else: assert pixel[1] > pixel[0]*1.2, f'Grass changed outside tread: {pixel}'
    assert original == [tuple(v.co) for v in mesh.vertices]


bake_patch([(26,6,55.7),(28,6,55.7),(28,8,55.7),(26,8,55.7)], True)
bake_patch([(0,6,55.7),(2,6,55.7),(2,8,55.7),(0,8,55.7)], False)
bake_patch([(26,6,55),(26,8,55),(26,8,56),(26,6,56)], False)
print('MAJESTIC_MASONRY_BOX_TEST_PASSED', flush=True)
