"""Prepare one reviewed Medieval Town model, simplifying each tier before UV."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
import bpy
import bmesh
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/medieval-town-vol1'
sys.path.insert(0, str(Path(__file__).parent))
from tile_mesh import activate, crop, shade
import tile_bake
from medieval_material import paint, material


def support_points(obj, recipe):
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    points = []
    locations = recipe.get('standPoints', [[x+.5, y+.5] for x, y in recipe['standCells']])
    for x, y in locations:
        center = recipe['mountCenterMM']
        origin = (center[0]+(x-recipe['width']/2)*35,
                  center[1]-(y-recipe['height']/2)*35, recipe.get('standRayTopMM', 1200))
        p, normal, _, _ = tree.ray_cast(origin, (0, 0, -1))
        if p is None or normal.z<.5 or p.z<recipe['mountDepthMM']+.1:
            raise ValueError(f'Invalid stand cell {x},{y}')
        points.append({'x': x, 'y': y, 'elevation': round(p.z/35, 6)})
    return points


def plain_mount_collar(target, recipe):
    """Keep the full mesh, separating the tiny untextured mounting rim."""
    thickness = recipe.get('plainMountCollarMM', 0)
    if not thickness:
        return None
    cutoff = recipe['mountDepthMM']+thickness
    collar = bpy.data.objects.new('Plain mounting rim', target.data.copy())
    bpy.context.collection.objects.link(collar)
    for obj, keep_bottom in [(collar, True), (target, False)]:
        bm = bmesh.new(); bm.from_mesh(obj.data)
        remove = [f for f in bm.faces if all(v.co.z<=cutoff for v in f.verts)!=keep_bottom]
        bmesh.ops.delete(bm, geom=remove, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(obj.data); bm.free(); obj.data.update()
    if not len(collar.data.polygons) or not len(target.data.polygons):
        raise ValueError('Mount collar separation removed the visible body')
    collar.data.materials.clear()
    mat = bpy.data.materials.new('Mount collar earth'); mat.use_nodes = True
    rgb = recipe['materials']['earthRGB']
    linear = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = .96
    collar.data.materials.append(mat)
    collar.hide_render = collar.hide_viewport = True
    print('MEDIEVAL_PLAIN_MOUNT_COLLAR', len(collar.data.polygons), thickness, flush=True)
    return collar


def prepare(code, tier, force):
    recipes = json.loads((ROOT/'scripts/maps/medieval-recipes.json').read_text())
    recipe = json.loads((Path(__file__).parent/recipes[code]).read_text())
    row = next(r for r in json.loads((BASE/'inventory.json').read_text()) if r['code']==code)
    source_path = ROOT/'models'/row['sourcePath']
    with source_path.open('rb') as f:
        if hashlib.file_digest(f, 'sha256').hexdigest()!=row['sourceSHA256']:
            raise ValueError('Source STL changed')
    out = BASE/'prepared'/code/tier
    out.mkdir(parents=True, exist_ok=True)
    if (out/'report.json').exists() and not force:
        raise ValueError('Already prepared; review changes before --force')
    start = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.threads_mode = 'FIXED'; scene.render.threads = 8
    bpy.ops.wm.stl_import(filepath=str(source_path))
    source = bpy.context.object; source.name = code+' sculpt'
    datum = recipe['mountDepthMM']
    crop(source, datum)
    for v in source.data.vertices:
        v.co.z += datum
    bm = bmesh.new(); bm.from_mesh(source.data)
    if bm.calc_volume(signed=True)<0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces)); bm.to_mesh(source.data)
    bm.free(); source.data.update()
    shade(source); paint(source, recipe); source.data.materials.append(material(recipe))
    original_points = support_points(source, recipe)
    target = bpy.data.objects.new(code+' '+tier, source.data.copy())
    bpy.context.collection.objects.link(target); activate(target)
    budget = recipe[tier+'Triangles']
    modifier = target.modifiers.new('Measured '+tier+' budget', 'DECIMATE')
    modifier.ratio = min(1, budget/len(target.data.polygons)); modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name); shade(target)
    collar = plain_mount_collar(target, recipe)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=recipe.get(tier+'UVAngleLimitRad', recipe.get('uvAngleLimitRad', .65)), island_margin=recipe.get(tier+'UVIslandMargin', recipe.get('uvIslandMargin', .002)),
                             margin_method='FRACTION', area_weight=.8)
    bpy.ops.object.mode_set(mode='OBJECT')
    target.data.materials[0] = target.data.materials[0].copy()
    tile_bake.SIZE = recipe[tier+'BakeSize']
    print('MEDIEVAL_BAKE', code, tier, len(target.data.polygons), flush=True)
    from medieval_torch import emission_bake
    tile_bake.bake(target, source, out, extra_bake=emission_bake(recipe))
    quality = tile_bake.validate_maps(target)
    points = support_points(target, recipe)
    deviations = [abs(a['elevation']-b['elevation'])*35 for a, b in zip(points, original_points)]
    if max(deviations, default=0)>recipe['standToleranceMM']:
        raise ValueError('Simplification changed the measured stand surface')
    maximum = max(v.co.z for v in source.data.vertices)/35
    source.hide_render = source.hide_viewport = True
    objects = [target]
    if collar is not None:
        collar.hide_render = collar.hide_viewport = False
        objects.append(collar)
    center = recipe['mountCenterMM']
    if datum:
        bottom, top = recipe['pegBottomHalfMM'], recipe['pegTopHalfMM']
        verts = [(center[0]+sx*r, center[1]+sy*r, z) for r, z in [(bottom, 0), (top, datum)]
                 for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        faces = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7)]
        for i in range(4):
            j = (i+1)%4; faces += [(i, j, j+4), (i, j+4, i+4)]
        mesh = bpy.data.meshes.new('Fitted insertion taper'); mesh.from_pydata(verts, [], faces); mesh.update()
        peg = bpy.data.objects.new('Fitted insertion taper', mesh); bpy.context.collection.objects.link(peg)
        mat = bpy.data.materials.new('Insertion earth'); mat.use_nodes = True
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.065, .045, .025, 1)
        mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .97
        peg.data.materials.append(mat); objects.append(peg)
    for obj in objects:
        for v in obj.data.vertices:
            v.co.x = (v.co.x-center[0])/35; v.co.y = (v.co.y-center[1])/35; v.co.z /= 35
    activate(target)
    for obj in objects[1:]: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'), export_format='GLB', use_selection=True,
                             export_animations=False, export_tangents=True, export_cameras=False, export_lights=False)
    model = {'collection': row['collection'], 'collectionName': row['collectionName'], 'sourceCode': code,
             'definitionId': code, 'code': recipe['groupCode'], 'sourceName': row['sourceName'], 'name': recipe['name'],
             'textureDetail': 'detailed', 'tileType': recipe['tileType'], 'hasDecor': recipe['hasDecor'],
             'canStand': bool(points), 'hidden': False, 'placementPoints': points, 'wallMode': recipe['wallMode'],
             'wallMask': recipe['wallMask'], 'width': recipe['width'], 'height': recipe['height'],
             'placementOffset': [0, 0], 'mountDepth': round(datum/35, 6),
             'surfaceHeight': max([p['elevation'] for p in points], default=datum/35), 'maxHeight': round(maximum, 6),
             'blockers': recipe['blockers'], 'tags': recipe['tags'], 'supportSlots': recipe['supportSlots']}
    report = {'model': model, 'sourcePath': row['sourcePath'], 'sourceSHA256': row['sourceSHA256'],
              'sourceTriangles': row['triangles'], 'triangles': sum(len(o.data.polygons) for o in objects),
              'mountCollarTriangles': len(collar.data.polygons) if collar is not None else 0,
              'weightBudget': recipe['weightBudget'], 'recipe': recipe, 'quality': quality,
              'standDeviationsMM': deviations, 'seconds': round(time.monotonic()-start, 2)}
    (out/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print('MEDIEVAL_PREPARED', code, tier, report['seconds'], quality, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    parser.add_argument('--tier', required=True, choices=['render', 'lod'])
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    prepare(args.code, args.tier, args.force)
