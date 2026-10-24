"""Blender: bake albedo, native PBR and tangent normals onto render/LOD geometry."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene


def read_pixels(image):
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(image.size[1], image.size[0], 4)


def fill_bake_gaps(maps):
    """Dilate observed albedo into ray misses; use neutral data maps there."""
    coverage = read_pixels(maps['coverage'].image)[..., 0].copy()
    image = maps['basecolor'].image
    width, height = image.size
    valid = (coverage > .5).reshape(height, width)
    original = valid.copy()
    pixels = read_pixels(image)
    for _ in range(32):
        before = valid.copy()
        for axis, shift in [(0,1), (0,-1), (1,1), (1,-1)]:
            nearby = np.roll(valid, shift, axis=axis)
            if axis == 0:
                nearby[0 if shift > 0 else -1, :] = False
            else:
                nearby[:, 0 if shift > 0 else -1] = False
            fill = ~valid & nearby
            pixels[fill] = np.roll(pixels, shift, axis=axis)[fill]
            valid |= fill
        if np.array_equal(before, valid):
            break
    image.pixels.foreach_set(pixels.ravel())
    image.save()
    for channel, neutral in [('normal', (.5,.5,1,1)), ('orm', (1,.88,0,1))]:
        image = maps[channel].image
        pixels = read_pixels(image)
        pixels[~original] = neutral
        if channel == 'normal':
            directions = pixels[..., :3]*2-1
            backwards = directions[..., 2] < 0
            directions[backwards] *= -1
            directions[..., 2] = np.maximum(directions[..., 2], .2)
            directions /= np.maximum(1e-8, np.linalg.norm(directions, axis=-1, keepdims=True))
            pixels[..., :3] = directions*.5+.5
        image.pixels.foreach_set(pixels.ravel())
        image.save()


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
    for channel in ['normal', 'basecolor', 'orm', 'coverage']:
        image = bpy.data.images.new(role + ' ' + channel, width=size, height=size, alpha=False)
        image.colorspace_settings.name = 'sRGB' if channel == 'basecolor' else 'Non-Color'
        if channel == 'normal':
            image.generated_color = (.5, .5, 1, 1)
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        mat.node_tree.nodes.active = node
        if channel != 'normal':
            for source, parts in sources.items():
                colour = parts['emission'].inputs['Color']
                if channel == 'coverage':
                    for link in list(colour.links):
                        source.node_tree.links.remove(link)
                    colour.default_value = (1,1,1,1)
                else:
                    source.node_tree.links.new(parts[channel].outputs['Color'], colour)
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
    fill_bake_gaps(maps)
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
parser.add_argument('--footprint', type=float, help='Normalize to this unit-token diameter instead of height')
parser.add_argument('--no-base', action='store_true', help='Keep feet at zero and use a separate runtime base')
parser.add_argument('--token-size', type=float, default=1, help='Nominal in-game token size for the report')
parser.add_argument('--recipe', type=Path, help='Use the recipe material profile for exports and the editable scene')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(args.recipe.read_text()).get('materialProfile', 'native') if args.recipe else 'native'
folder = args.directory.resolve()
high = scene.import_glb(folder / 'trellis-native/generated-original.glb')
if args.footprint:
    from mathutils import Vector
    points = np.array([tuple(p) for p in scene.points(high)])
    low, top = points.min(axis=0), points.max(axis=0)
    centre = Vector(((low[0]+top[0])/2, (low[1]+top[1])/2, low[2]))
    radius = np.max(np.linalg.norm(points[:, :2]-np.array(centre)[:2], axis=1))
    transform = Matrix.Translation((0,0,0 if args.no_base else .06)) @ Matrix.Scale(args.footprint/(2*radius),4) @ Matrix.Translation(-centre)
else:
    transform = scene.normalize(high, args.height)
    if args.no_base:
        transform = Matrix.Translation((0,0,-.06)) @ transform
transform = Matrix.Rotation(math.radians(args.rotation),4,'Z') @ transform
for obj in high:
    obj.matrix_world = transform @ obj.matrix_world
if not args.no_base:
    scene.base()
scene.material_profile(high, profile)
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
        scene.material_profile(low, profile)
    for obj in high:
        bpy.data.objects.remove(obj, do_unlink=True)
    if not args.no_base:
        scene.base()
    scene.export_glb(folder / ('model.glb' if role == 'render' else f'model-{role}.glb'), shadow=role == 'shadow')
    if role == 'render':
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'model.blend'))
        scene.render(folder)
    if role == 'lod':
        scene.render(folder, [('lod-preview', 254, 25), ('lod-top', 254, 78)])
(folder / 'placement.json').write_text(json.dumps({'baseDiameterCells': None if args.no_base else .9,
    'nativeFootprintDiameter': args.footprint, 'embeddedBase': not args.no_base,
    'nominalFootprintCells': [args.token_size, args.token_size],
    'originalServiceMeshExported': True,
    'transform': [list(row) for row in transform]}, indent=2) + '\n')
