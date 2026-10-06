"""Prepare exactly one reviewed Majestic Highlands tile per invocation."""
import argparse
import json
from pathlib import Path
import sys
import time
import bpy
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_mesh import activate, crop, shade
import tile_bake
from majestic_grass import paint, material


def add_peg(centre, height, recipe):
    x, y = centre
    bottom, top = recipe['pegBottomHalfMM'], recipe['pegTopHalfMM']
    verts = [(x+sx*r, y+sy*r, z) for r, z in [(bottom, 0), (top, height)]
             for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    faces = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7)]
    for i in range(4):
        j = (i+1) % 4
        faces.extend([(i, j, j+4), (i, j+4, i+4)])
    mesh = bpy.data.meshes.new('Simple XL insertion taper')
    mesh.from_pydata(verts, [], faces); mesh.update()
    obj = bpy.data.objects.new('Simple XL insertion taper', mesh)
    bpy.context.collection.objects.link(obj)
    mat = bpy.data.materials.new('Insertion earth'); mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.032, .022, .012, 1)
    shader.inputs['Roughness'].default_value = .96
    obj.data.materials.append(mat)
    return obj


def support_points(obj, centre, recipe, datum):
    obj.data.update()
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    points, invalid = [], []
    for y in range(recipe['height']):
        for x in range(recipe['width']):
            if [x,y] in recipe.get('blockedCells',[]): continue
            position=(centre[0]+(x-(recipe['width']-1)/2)*35,
                      centre[1]-(y-(recipe['height']-1)/2)*35,recipe.get('standMaxZMM',100))
            hit=tree.ray_cast(position,(0,0,-1))
            if hit[0] is None or hit[0].z<datum+.5:
                invalid.append([x,y])
            else:
                points.append({'x':x+.5,'y':y+.5,'elevation':round(hit[0].z/35,6)})
    if invalid: raise ValueError(f'Cells {invalid} have no standable surface; review occupied cells before baking')
    return points


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--optimized-tier', choices=['render', 'lod'])
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    recipes = json.loads((ROOT/'scripts/maps/majestic-recipes.json').read_text())
    if args.code not in recipes: raise ValueError('No individually reviewed recipe for '+args.code)
    recipe = json.loads((Path(__file__).parent/recipes[args.code]).read_text())
    base = ROOT/'models/collections/majestic-highlands'
    row = next(r for r in json.loads((base/'manifest.json').read_text()) if r['code']==args.code)
    out = base/'prepared'/args.code
    budget = 120000
    if args.optimized_tier:
        budget = recipe['renderTriangles' if args.optimized_tier=='render' else 'lodTriangles']
        out = base/'optimized-native'/args.code/args.optimized_tier
    out.mkdir(parents=True, exist_ok=True)
    if (out/'report.json').exists() and not args.force:
        raise ValueError('Already prepared; use --force after reviewing changes')
    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.threads_mode = 'FIXED'; scene.render.threads = 8
    bpy.ops.wm.stl_import(filepath=str(ROOT/'models'/row['sourcePath']))
    source = bpy.context.object; source.name = args.code+' sculpt'
    datum = recipe['mountDepthMM']
    crop(source, datum)
    for v in source.data.vertices: v.co.z += datum
    support_points(source, row['mountCenterMM'], recipe, datum)
    shade(source); paint(source, recipe, args.code); source.data.materials.append(material())
    target = bpy.data.objects.new(args.code+' browser', source.data.copy())
    bpy.context.collection.objects.link(target); activate(target)
    decimate = target.modifiers.new('Browser surface budget', 'DECIMATE')
    decimate.ratio = min(1, budget/len(target.data.polygons)); decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name); shade(target)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.35, island_margin=.0015, margin_method='FRACTION', area_weight=.8)
    bpy.ops.object.mode_set(mode='OBJECT')
    target.data.materials[0] = target.data.materials[0].copy()
    tile_bake.SIZE = 1024 if args.optimized_tier=='lod' else 2048
    print('MAJESTIC_BAKE', args.code, len(target.data.polygons), flush=True)
    tile_bake.bake(target, source, out)
    quality = tile_bake.validate_maps(target)
    source.hide_render = True; source.hide_viewport = True
    centre = row['mountCenterMM']
    peg = add_peg(centre, datum, recipe)
    points = support_points(target, centre, recipe, datum)
    high = max(v.co.z for v in target.data.vertices)/35
    for obj in [target, peg]:
        for v in obj.data.vertices:
            v.co.x = (v.co.x-centre[0])/35; v.co.y = (v.co.y-centre[1])/35; v.co.z /= 35
    activate(target); peg.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'), export_format='GLB', use_selection=True,
                             export_animations=False, export_tangents=True, export_cameras=False, export_lights=False)
    report = {**row, 'width':recipe['width'], 'height':recipe['height'], 'reviewStatus':'prepared', 'footprintReviewed':True, 'mountDepth':round(datum/35,6), 'maxHeight':round(high,6),
              'surfaceHeight':max(p['elevation'] for p in points), 'placementPoints':points,
              'renderTriangles':len(target.data.polygons)+12, 'pegTriangles':12,
              'geometryBudget':budget, 'recipe':recipe, 'quality':quality, 'seconds':round(time.monotonic()-started,2)}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('MAJESTIC_PREPARED', args.code, report['seconds'], quality, flush=True)


if __name__ == '__main__': main()
