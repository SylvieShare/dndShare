"""Render prepared GLB revisions; source files and screenshots stay in models/."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from preview_alpha import transparent_preview


def preview(report, size=256, front=False, review=False, inside=False, focus_max_z=None, tier='render', transparent=False, camera_shift_y=0, outside=False):
    directory = report.parent
    prefix = 'focus-' if focus_max_z is not None else ''
    if tier == 'lod':
        prefix = 'lod-' + prefix
    if transparent:
        prefix = 'transparent-' + prefix
    if transparent_preview(directory/(prefix+'preview.png')) and not review:
        return
    row = json.loads(report.read_text())['model']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory/('lod-preview-model.glb' if tier=='lod' else 'preview-model.glb')))
    scene = bpy.context.scene
    for obj in list(scene.objects):
        if obj.parent is None:
            obj.location.x += row['placementOffset'][0]
            obj.location.y -= row['placementOffset'][1]
            obj.location.z -= row['mountDepth']
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('Preview world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.09, .105, .13, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    for name, energy, position in [('Key', 3, (75, -105, 110)), ('Fill', 1.2, (-70, 60, 80))]:
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        light.angle = .35
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.rotation_euler = (-Vector(position)).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    scene.collection.objects.link(camera)
    camera.data.type = 'ORTHO'
    camera.data.shift_y = camera_shift_y
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world@Vector(corner) for obj in scene.objects
              if obj.type == 'MESH' for corner in obj.bound_box]
    low = Vector(tuple(min(point[axis] for point in bounds) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in bounds) for axis in range(3)))
    if focus_max_z is not None:
        high.z = min(high.z, focus_max_z/35-row['mountDepth'])
    centre = (low+high)/2
    direction = Vector((2, 2.85, 2.45) if outside else (-2, -2.85, 2.45) if inside else (-2, 2.85, 2.45) if front else (2, -2.85, 2.45)).normalized()
    distance = max((high-low).length, 1)*2+5
    camera.location = centre+direction*distance
    camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.clip_end = distance*4
    bpy.context.view_layer.update()
    projected = [camera.matrix_world.inverted()@point for point in bounds]
    camera.data.ortho_scale = max(max(p.x for p in projected)-min(p.x for p in projected),
                                 max(p.y for p in projected)-min(p.y for p in projected), .1)*1.18
    scene.camera = camera
    scene.render.filepath = str(directory/(prefix+'preview.png'))
    bpy.ops.render.render(write_still=True)
    if review:
        for name, position in [('reverse', (2, -2.85, 2.45)), ('top', (0, -.01, 5))]:
            camera.location = centre+Vector(position)
            camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(directory/(prefix+name+'.png'))
            bpy.ops.render.render(write_still=True)
    print('PREVIEW_REVISION', row['sourceCode'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--codes', nargs='*')
    parser.add_argument('--source-name')
    parser.add_argument('--size', type=int, choices=[256, 512, 1024], default=256)
    parser.add_argument('--front', action='store_true')
    parser.add_argument('--review', action='store_true')
    parser.add_argument('--inside', action='store_true')
    parser.add_argument('--outside', action='store_true', help='Show the positive-X decorated side from the other diagonal')
    parser.add_argument('--focus-max-z', type=float)
    parser.add_argument('--tier', choices=['render','lod'], default='render')
    parser.add_argument('--transparent', action='store_true', help='Write transparent-preview.png separately; every public preview has alpha')
    parser.add_argument('--camera-shift-y', type=float, default=0, help='Vertical framing shift in fractions of the square image')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for report in sorted(args.base.glob('*/report.json')):
        if args.source_name and json.loads(report.read_text())['model']['sourceName'] != args.source_name:
            continue
        if args.codes and json.loads(report.read_text())['model']['sourceCode'] not in args.codes:
            continue
        preview(report, args.size, args.front, args.review, args.inside, args.focus_max_z, args.tier, args.transparent, args.camera_shift_y, args.outside)
