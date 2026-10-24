"""Reserve measured atlas regions for details that lose colour in a shared UV map."""
from array import array
import hashlib
import math

import bpy
import bmesh


def geometry_hash(mesh):
    positions = array('f', [0]) * (len(mesh.vertices) * 3)
    indices = array('i', [0]) * len(mesh.loops)
    mesh.vertices.foreach_get('co', positions)
    mesh.loops.foreach_get('vertex_index', indices)
    return hashlib.sha256(positions.tobytes() + indices.tobytes()).hexdigest()


def validate_tiles(base, regions):
    tiles = [base] + [region['tile'] for region in regions]
    for tile in tiles:
        if len(tile) != 4 or not all(math.isfinite(v) for v in tile):
            raise ValueError('Finite UV tile bounds required')
        if not (0 <= tile[0] < tile[2] <= 1 and 0 <= tile[1] < tile[3] <= 1):
            raise ValueError('UV tile must have positive area inside the atlas')
    for i, a in enumerate(tiles):
        for b in tiles[:i]:
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                raise ValueError('UV detail tiles must not overlap')
    for region in regions:
        if len(region['minMM']) != 3 or len(region['maxMM']) != 3:
            raise ValueError('Native detail bounds require three coordinates')
        if not all(math.isfinite(a) and math.isfinite(b) and a < b
                   for a, b in zip(region['minMM'], region['maxMM'])):
            raise ValueError('Native detail bounds must have positive dimensions')


def unwrap_detail_regions(target, recipe, tier):
    regions = recipe['uvDetailRegions']
    if not regions:
        raise ValueError('At least one measured detail region is required')
    base = recipe['uvBaseTile']
    validate_tiles(base, regions)
    mesh = target.data
    before = geometry_hash(mesh)
    assignments = []
    for face in mesh.polygons:
        point = face.center
        matches = [i + 1 for i, region in enumerate(regions)
                   if all(a <= v <= b for v, a, b in
                          zip(point, region['minMM'], region['maxMM']))]
        if len(matches) > 1:
            raise ValueError('A face belongs to multiple UV detail regions')
        assignments.append(matches[0] if matches else 0)
    groups = [{'name': 'base', 'tile': base}] + regions
    if not mesh.uv_layers:
        mesh.uv_layers.new(name='UVMap')
    previous_selection = bpy.context.tool_settings.mesh_select_mode[:]
    bpy.context.tool_settings.mesh_select_mode = (False, False, True)
    bpy.ops.object.mode_set(mode='EDIT')
    evidence = []
    try:
        for group_index, group in enumerate(groups):
            bpy.ops.mesh.select_all(action='DESELECT')
            bm = bmesh.from_edit_mesh(mesh)
            bm.faces.ensure_lookup_table()
            selected = [face for face in bm.faces
                        if assignments[face.index] == group_index]
            if not selected:
                raise ValueError('Empty UV group: ' + group['name'])
            for face in selected:
                face.select_set(True)
            bmesh.update_edit_mesh(mesh, loop_triangles=False, destructive=False)
            x0, y0, x1, y1 = group['tile']
            width, height = x1 - x0, y1 - y0
            angle = group.get('angleLimitRad', recipe.get(tier+'UVAngleLimitRad', .65))
            margin = group.get('islandMargin', recipe.get(tier+'UVIslandMargin', .002))
            # Keep the requested gutter width after scaling into a smaller tile.
            bpy.ops.uv.smart_project(angle_limit=angle,
                                     island_margin=margin/min(width, height),
                                     margin_method='FRACTION', area_weight=.8)
            bm = bmesh.from_edit_mesh(mesh)
            layer = bm.loops.layers.uv.active
            count = 0
            for face in bm.faces:
                if assignments[face.index] != group_index:
                    continue
                for loop in face.loops:
                    uv = loop[layer].uv
                    uv.x, uv.y = x0 + uv.x * width, y0 + uv.y * height
                    if not (x0-1e-6 <= uv.x <= x1+1e-6 and
                            y0-1e-6 <= uv.y <= y1+1e-6):
                        raise ValueError(f'Unwrapped face escaped its UV tile: {group["name"]}, uv={tuple(uv)}, tile={group["tile"]}')
                    count += 1
            bmesh.update_edit_mesh(mesh, loop_triangles=False, destructive=False)
            evidence.append(dict(name=group['name'], faces=len(selected),
                                 loops=count, tile=group['tile'],
                                 angleLimitRad=angle, islandMargin=margin))
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.context.tool_settings.mesh_select_mode = previous_selection
    if geometry_hash(mesh) != before:
        raise ValueError('Detail UV allocation changed the mesh geometry')
    result = dict(geometryUnchanged=True, geometrySHA256=before, groups=evidence)
    print('MEDIEVAL_DETAIL_UV', result, flush=True)
    return result
