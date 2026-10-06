"""Render prepared GLB revisions; source files and screenshots stay in models/."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def preview(report, size=256, front=False, review=False, inside=False):
    directory = report.parent
    if (directory/'preview.png').exists() and not review:
        return
    row = json.loads(report.read_text())['model']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory/'preview-model.glb'))
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
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world@Vector(corner) for obj in scene.objects
              if obj.type == 'MESH' for corner in obj.bound_box]
    low = Vector(tuple(min(point[axis] for point in bounds) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in bounds) for axis in range(3)))
    camera.data.ortho_scale = max(*(high-low), 1)*1.5
    centre = (low+high)/2
    camera.location = centre+Vector((-2, -2.85, 2.45) if inside else (-2, 2.85, 2.45) if front else (2, -2.85, 2.45))
    camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.filepath = str(directory/'preview.png')
    bpy.ops.render.render(write_still=True)
    if review:
        for name, position in [('reverse', (2, -2.85, 2.45)), ('top', (0, -.01, 5))]:
            camera.location = centre+Vector(position)
            camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(directory/(name+'.png'))
            bpy.ops.render.render(write_still=True)
    print('PREVIEW_REVISION', row['sourceCode'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--codes', nargs='*')
    parser.add_argument('--size', type=int, choices=[256, 512, 1024], default=256)
    parser.add_argument('--front', action='store_true')
    parser.add_argument('--review', action='store_true')
    parser.add_argument('--inside', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for report in sorted(args.base.glob('*/report.json')):
        if args.codes and json.loads(report.read_text())['model']['sourceCode'] not in args.codes:
            continue
        preview(report, args.size, args.front, args.review, args.inside)
