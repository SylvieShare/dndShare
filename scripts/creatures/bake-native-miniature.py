"""Blender: bake albedo, native PBR and tangent normals onto render/LOD geometry."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene


def bake(high, low, folder, role):
    mat = bpy.data.materials.new('Native ' + role)
    mat.use_nodes = True
    for obj in low:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for face in obj.data.polygons:
            face.use_smooth = True
    context = bpy.context.scene
    context.render.engine, context.cycles.device, context.cycles.samples = 'CYCLES', 'CPU', 1
    context.render.threads_mode, context.render.threads = 'FIXED', 8
    sources = {}
    for obj in high:
        for source in obj.data.materials:
            if source in sources:
                continue
            textures = [n for n in source.node_tree.nodes if n.type == 'TEX_IMAGE']
            sources[source] = {
                'basecolor': next(n for n in textures if n.image.colorspace_settings.name == 'sRGB'),
                'orm': next(n for n in textures if n.image.colorspace_settings.name == 'Non-Color'),
                'emission': source.node_tree.nodes.new('ShaderNodeEmission'),
            }
    maps = {}
    size = 2048 if role == 'render' else 1024
    for channel in ['normal', 'basecolor', 'orm']:
        image = bpy.data.images.new(role + ' ' + channel, width=size, height=size, alpha=False)
        image.colorspace_settings.name = 'sRGB' if channel == 'basecolor' else 'Non-Color'
        if channel == 'normal':
            image.generated_color = (.5, .5, 1, 1)
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        mat.node_tree.nodes.active = node
        if channel != 'normal':
            for source, parts in sources.items():
                source.node_tree.links.new(parts[channel].outputs['Color'], parts['emission'].inputs['Color'])
                output = next(n for n in source.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
                source.node_tree.links.new(parts['emission'].outputs['Emission'], output.inputs['Surface'])
        bpy.ops.object.select_all(action='DESELECT')
        for obj in high + low:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = low[0]
        print('Baking', role, channel, flush=True)
        bpy.ops.object.bake(type='NORMAL' if channel == 'normal' else 'EMIT',
            use_selected_to_active=True, max_ray_distance=.035, cage_extrusion=.006, margin=8)
        image.filepath_raw = str(folder / f'{role}-{channel}.png')
        image.file_format = 'PNG'
        image.save()
        maps[channel] = node
    shader = mat.node_tree.nodes.get('Principled BSDF')
    links, nodes = mat.node_tree.links, mat.node_tree.nodes
    links.new(maps['basecolor'].outputs['Color'], shader.inputs['Base Color'])
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(maps['normal'].outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(maps['orm'].outputs['Color'], channels.inputs['Color'])
    links.new(channels.outputs['Green'], shader.inputs['Roughness'])
    links.new(channels.outputs['Blue'], shader.inputs['Metallic'])


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--height', type=float, default=1.4)
parser.add_argument('--rotation', type=float, default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
folder = args.directory.resolve()
high = scene.import_glb(folder / 'trellis-native/generated-original.glb')
transform = Matrix.Rotation(math.radians(args.rotation),4,'Z') @ scene.normalize(high, args.height)
for obj in high:
    obj.matrix_world = transform @ obj.matrix_world
scene.base()
scene.export_glb(folder / 'model-source.glb')
for role in ['render', 'lod', 'shadow']:
    high = scene.import_glb(folder / 'trellis-native/generated-original.glb')
    for obj in high:
        obj.matrix_world = transform @ obj.matrix_world
    low = scene.import_glb(folder / f'geometry-{role}.glb', replace=False)
    for obj in low:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()
    if role != 'shadow':
        bake(high, low, folder, role)
    for obj in high:
        bpy.data.objects.remove(obj, do_unlink=True)
    scene.base()
    scene.export_glb(folder / ('model.glb' if role == 'render' else f'model-{role}.glb'), shadow=role == 'shadow')
    if role == 'render':
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'model.blend'))
        scene.render(folder)
    if role == 'lod':
        scene.render(folder, [('lod-preview', 254, 25), ('lod-top', 254, 78)])
(folder / 'placement.json').write_text(json.dumps({'baseDiameterCells': .9,
    'transform': [list(row) for row in transform]}, indent=2) + '\n')
