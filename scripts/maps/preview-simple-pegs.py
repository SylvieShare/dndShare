"""Render previews of simplified GLBs in Blender; all outputs remain ignored."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from preview_alpha import transparent_preview

BASE = Path(__file__).resolve().parents[2]/'models/collections/simple-pegs'


def preview(report):
    directory=report.parent
    if transparent_preview(directory/'preview.png'):
        return
    row=json.loads(report.read_text())['model']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory/'preview-model.glb'))
    scene=bpy.context.scene
    for obj in list(scene.objects):
        if obj.parent is None:
            obj.location.z-=row['mountDepth']
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=scene.render.resolution_y=256
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Preview world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.09,.105,.13,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
    for name,energy,position in [('Key',3,(75,-105,110)),('Fill',1.2,(-70,60,80))]:
        light=bpy.data.lights.new(name,'SUN');light.energy=energy;light.angle=.35
        obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj)
        obj.rotation_euler=(-Vector(position)).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(camera)
    camera.data.type='ORTHO';camera.data.ortho_scale=max(row['width'],row['height'],row['maxHeight'],1)*1.5
    centre=Vector((0,0,(row['maxHeight']-row['mountDepth'])/2))
    camera.location=centre+Vector((2,-2.85,2.45));camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera;scene.render.filepath=str(directory/'preview.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW_PEG',row['collection'],row['sourceCode'],flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--codes',nargs='*')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for report in sorted(BASE.glob('*/report.json')):
        if args.codes and json.loads(report.read_text())['model']['sourceCode'] not in args.codes:
            continue
        preview(report)
