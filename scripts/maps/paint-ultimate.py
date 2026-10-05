"""Prepare coloured Ultimate Dungeon revisions without modifying originals.

Blender --background --python-exit-code 1 --python scripts/maps/paint-ultimate.py
All source and generated assets live in the ignored models/ directory.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_mesh import activate, crop, shade
from ultimate_paint import paint, material
from tile_bake import bake, validate_maps

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'models'
OUT = MODELS / 'collections/painted/ultimate-dungeon'


def preview(obj, directory, row, top):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('Preview background')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.09, .105, .13, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    for name, energy, position in [('Key', 3, (75, -105, 110)), ('Fill', 1.2, (-70, 60, 80))]:
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        light.angle = .35
        lamp = bpy.data.objects.new(name, light)
        scene.collection.objects.link(lamp)
        lamp.rotation_euler = (-Vector(position)).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    scene.collection.objects.link(camera)
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = max(row['width'], row['height'], top, 1) * 50
    center = Vector(((row['min'][0]+row['max'][0])/2, (row['min'][1]+row['max'][1])/2, top*35/2))
    camera.location = center + Vector((70, -100, 85))
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.filepath = str(directory/'preview.png')
    bpy.ops.render.render(write_still=True)


def prepare(row):
    slug = row.get('outputSlug', row['code'].replace(' ', '_'))
    directory = OUT/slug
    directory.mkdir(parents=True, exist_ok=True)
    if (directory/'report.json').exists():
        return
    started = time.monotonic()
    print('START_PAINT', slug, flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    bpy.ops.wm.stl_import(filepath=str(MODELS/row['sourcePath']))
    source = bpy.context.object
    crop(source, row['cutHeight'])
    shade(source)
    paint(source, row)
    source.data.materials.clear()
    source.data.materials.append(material())
    target = bpy.data.objects.new(slug+' painted', source.data.copy())
    scene.collection.objects.link(target)
    activate(target)
    budget = min(120000, int(40000*math.sqrt(row['width']*row['height'])))
    modifier = target.modifiers.new('Browser geometry', 'DECIMATE')
    modifier.ratio = min(1, budget/max(1, len(target.data.polygons)))
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    shade(target)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.35, island_margin=.0015,
                            margin_method='FRACTION', area_weight=.8)
    bpy.ops.object.mode_set(mode='OBJECT')
    target.data.materials[0] = target.data.materials[0].copy()
    source.hide_render = True
    bake(target, source, directory)
    quality = validate_maps(target)
    top = max(v.co.z for v in source.data.vertices)/35
    for v in target.data.vertices:
        v.co /= 35
    activate(target)
    bpy.ops.export_scene.gltf(filepath=str(directory/'model.glb'), check_existing=False,
        export_format='GLB', use_selection=True, export_animations=False,
        export_cameras=False, export_lights=False, export_texcoords=True,
        export_normals=True, export_tangents=True)
    for v in target.data.vertices:
        v.co *= 35
    preview(target, directory, row, top)
    result = {**row, 'renderTriangles': len(target.data.polygons),
              'seconds': round(time.monotonic()-started, 2), 'quality': quality}
    (directory/'report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print('DONE_PAINT', slug, result['seconds'], quality, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--codes', nargs='*')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    rows = json.loads((MODELS/'collections/manifest.json').read_text())
    rows = [r for r in rows if r['collection']=='ultimate-dungeon' and
            (not args.codes or r['code'] in args.codes)]
    errors = []
    for row in rows:
        try:
            prepare(row)
        except Exception as error:
            errors.append({'code': row['code'], 'error': repr(error)})
            print('FAILED_PAINT', row['code'], repr(error), flush=True)
    if errors:
        raise RuntimeError(json.dumps(errors))
    print('PAINT_COMPLETE', len(rows), flush=True)


if __name__ == '__main__':
    main()
