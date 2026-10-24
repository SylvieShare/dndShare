"""Probe every measured glass opening on both native packed surfaces."""
import argparse
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
sys.path.insert(0, str(Path(__file__).parent))
from medieval_glass_review import expected_glass_rgb, glass_chromaticity_error, CHROMATICITY_TOLERANCE
from medieval_structure import domain, initialize_references

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('liquid_pixel_helpers', Path(__file__).with_name('validate-medieval-liquids.py'))
helpers = importlib.util.module_from_spec(spec); spec.loader.exec_module(helpers)


def pane_probes(part):
    result = part.get('probesMM', [dict(key='centre', pointMM=part.get('probeMM', [(a+b)/2 for a,b in zip(part['minMM'],part['maxMM'])]))])
    if not result or len({p['key'] for p in result}) != len(result):
        raise ValueError('Distinct measured pane probes required')
    return result


def validate(code, candidate):
    directory = ROOT/'models/collections/medieval-town-vol1/review'/code
    if candidate: directory /= 'candidates/'+candidate
    report_path = directory/'report.json'; report = json.loads(report_path.read_text())
    parts = [p for p in report['recipe']['materials'].get('surfaceParts', []) if p.get('kind') == 'glass']
    if not parts: raise ValueError('Measured glass panes required')
    if abs(report['model']['mountDepth']-report['recipe']['mountDepthMM']/35) > 1e-5:
        raise ValueError('Validate native glass before standardizing the selected resources')
    cx, cy = report['recipe']['mountCenterMM']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(ROOT/'models'/report['sourcePath']))
    source = BVHTree.FromObject(bpy.context.object, bpy.context.evaluated_depsgraph_get())
    initialize_references(report['recipe']['materials'])
    references = {}
    for part in parts:
        for probe in pane_probes(part):
            x, y, z = probe['pointMM']
            for side in [-1, 1]:
                # Start inside the measured layer to find its own exit face,
                # then choose verified nearby air instead of a remote roof ray.
                h = source.ray_cast((x, y, z), (side, 0, 0))
                if h[0] is None or h[1].x*side < .5 or not domain(np.array([h[0]]), part)[0]:
                    raise ValueError('Source probe missed its measured glass face: '+part['name']+' '+probe['key'])
                origin_x = None
                for step in [.3, .15, .1, .05, .025, .01]:
                    trial = h[0].x+side*step
                    check = source.ray_cast((trial, y, z), (-side, 0, 0))
                    if check[0] is not None and (check[0]-h[0]).length < .001:
                        origin_x = trial; break
                if origin_x is None: raise ValueError('No verified local air outside glass')
                references[part['name'], probe['key'], side] = (y, z, h[0].x, origin_x)
    evidence = {}
    for tier, filename in [('render', 'preview-model.glb'), ('lod', 'lod-preview-model.glb')]:
        if helpers.base_color_images(directory/filename) != helpers.base_color_images(directory/(tier+'.glb')):
            raise ValueError('Preview albedo differs from actual packed '+tier)
        bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=str(directory/filename))
        meshes = [(o, BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())) for o in bpy.context.scene.objects if o.type == 'MESH']
        rows = []
        for part in parts:
            for probe in pane_probes(part):
                for side in [-1, 1]:
                    y, z, reference, origin_x = references[part['name'], probe['key'], side]; hits = []
                    for obj, tree in meshes:
                        inv = obj.matrix_world.inverted()
                        hit = tree.ray_cast(inv@Vector(((origin_x-cx)/35, (y-cy)/35, z/35)), inv.to_3x3()@Vector((-side, 0, 0)))
                        if hit[0] is not None: hits.append(((obj.matrix_world@hit[0]).x*35+cx, obj, hit))
                    if not hits: raise ValueError('Missing pane: '+part['name']+' '+probe['key'])
                    actual_x, obj, hit = max(hits, key=lambda row: row[0]*side)
                    normal = obj.matrix_world.to_3x3()@hit[1]; normal.normalize()
                    polygon = obj.data.polygons[hit[2]]; loops = list(polygon.loop_indices)
                    if len(loops) != 3: raise ValueError('Triangulated pane required')
                    positions = [obj.data.vertices[obj.data.loops[i].vertex_index].co for i in loops]
                    coords = [Vector((*obj.data.uv_layers.active.data[i].uv, 0)) for i in loops]
                    uv = barycentric_transform(hit[0], *positions, *coords)
                    shader = next(n for n in obj.data.materials[polygon.material_index].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                    colour = helpers.sample_image(shader.inputs['Base Color'].links[0].from_node.image, uv)
                    expected = expected_glass_rgb(part['rgb']); error = glass_chromaticity_error(colour, expected)
                    brightness = sum(colour)/sum(expected)
                    row = dict(name=part['name'], probeKey=probe['key'], probeMM=probe['pointMM'], side=side,
                               positionMM=[actual_x, y, z], referenceXMM=reference, sourceOriginXMM=origin_x,
                               deviationMM=abs(actual_x-reference), normalFacing=normal.x*side, sampledRGB=colour,
                               colourReviewVersion=1, recipeRGB=part['rgb'], expectedPackedRGB=expected, chromaticityError=error, brightnessRatio=brightness)
                    print('MEDIEVAL_GLASS_PIXEL', code, tier, json.dumps(row), flush=True)
                    if abs(actual_x-reference) > .15 or normal.x*side < .5: raise ValueError('Pane geometry changed')
                    if error > CHROMATICITY_TOLERANCE: raise ValueError('Packing changed the measured glass palette')
                    if not .75 <= brightness <= 1.25: raise ValueError('Glass pigment lost brightness')
                    rows.append(row)
        evidence[tier] = rows
    report['glassPixelReview'] = evidence
    report['glassPixelAssets'] = {tier: sha256((directory/(tier+'.glb')).read_bytes()).hexdigest() for tier in ['render', 'lod']}
    report_path.write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--code', required=True); parser.add_argument('--candidate', choices=['compact'])
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:]); validate(args.code, args.candidate)
