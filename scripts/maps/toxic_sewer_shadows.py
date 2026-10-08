"""Diagnostic shadows from the exact published shadow geometry, with three lights."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def render(report):
    row = json.loads(report.read_text())['model']
    directory = report.parent
    for name, kind, position in [('sun-east', 'SUN', (2, -3, 4)),
                                  ('sun-west', 'SUN', (-3, 1, 2)),
                                  ('point', 'POINT', (-1.5, -1.5, 2.2))]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        bpy.ops.import_scene.gltf(filepath=str(directory/'shadow-preview.glb'))
        for obj in list(scene.objects):
            if obj.parent is None:
                obj.location.x += row['placementOffset'][0]
                obj.location.y -= row['placementOffset'][1]
                obj.location.z -= row['mountDepth']
        bpy.ops.mesh.primitive_plane_add(size=max(row['width'], row['height'])*4, location=(0, 0, -.005))
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 24
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = 8
        scene.render.resolution_x = scene.render.resolution_y = 384
        scene.render.resolution_percentage = 100
        scene.view_settings.view_transform = 'AgX'
        scene.world = bpy.data.worlds.new('Diagnostic ambient')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .12
        light = bpy.data.lights.new(name, kind)
        light.energy = 3 if kind == 'SUN' else 180
        lamp = bpy.data.objects.new(name, light)
        scene.collection.objects.link(lamp)
        lamp.location = position
        lamp.rotation_euler = (-Vector(position)).to_track_quat('-Z', 'Y').to_euler()
        centre = Vector((0, 0, row['maxHeight']/2))
        camera = bpy.data.objects.new('Review camera', bpy.data.cameras.new('Review camera'))
        scene.collection.objects.link(camera)
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = max(row['width'], row['height'], row['maxHeight'])*3.4
        # View the east shadow from the shaded side; the old camera hid it
        # directly behind the model along the incoming sunlight direction.
        camera.location = centre + Vector((-3, 4, 3) if name == 'sun-east' else (3, -4, 3))
        camera.rotation_euler = (centre-camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = camera
        scene.render.filepath = str(directory/('shadow-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
    data = json.loads(report.read_text())
    data['shadowReview'] = {'geometry': 'Published shadow decoded without textures',
                            'viewTransform': 'AgX',
                            'cameraVariant': 'visible-east-shadow',
                            'views': ['sun-east', 'sun-west', 'point']}
    report.write_text(json.dumps(data, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    render(args.report)
