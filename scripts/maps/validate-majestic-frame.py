"""Verify native frame holes, socket drift and complete insertion volumes."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/majestic-highlands'


def clip(poly, normal, constant):
    result = []
    for index, a in enumerate(poly):
        b = poly[(index+1) % len(poly)]
        da, db = normal.dot(a)+constant, normal.dot(b)+constant
        if da <= 0:
            result.append(a)
        if (da < 0) != (db < 0):
            result.append(a+(b-a)*(da/(da-db)))
    return result


def profile_volumes(profile, elevation, translation=(0, 0), rotation=0):
    sections = profile['sectionsMM']
    offset = Vector((*translation, elevation-profile['depthMM']))
    angle = math.radians(rotation)
    cosine, sine = math.cos(angle), math.sin(angle)
    for lower, upper in zip(sections, sections[1:]):
        z0, radius0 = lower
        z1, radius1 = upper
        slope = (radius1-radius0)/(z1-z0)
        intercept = radius0-slope*z0
        sides = [(None, None)] if 'holeHalfMM' not in profile else [(0, 1), (0, -1), (1, 1), (1, -1)]
        for axis, sign in sides:
            planes = [(Vector((0, 0, -1)), z0+.01), (Vector((0, 0, 1)), -z1+.01)]
            for side, direction in [(0, 1), (0, -1), (1, 1), (1, -1)]:
                normal = Vector((0, 0, -slope))
                normal[side] = direction
                planes.append((normal, -intercept+.01))
            if axis is not None:
                normal = Vector((0, 0, 0))
                normal[axis] = -sign
                planes.append((normal, profile['holeHalfMM']+.01))
            yield offset, cosine, sine, z0, z1, max(radius0, radius1), planes


def collisions(vertices, faces, volumes):
    if not faces:
        return 0
    positions = np.array([tuple(p) for p in vertices], dtype=np.float64)
    indices = np.asarray(faces, dtype=np.int64)
    lower = np.column_stack([positions[indices, axis].min(1) for axis in range(3)])
    upper = np.column_stack([positions[indices, axis].max(1) for axis in range(3)])
    position_scale = max(1, np.abs(positions).max())
    hit = set()
    for offset, cosine, sine, z0, z1, radius, planes in volumes:
        origin = np.asarray(tuple(offset))
        # Enclose the rotated square in world axes. The padding covers the
        # float32 arithmetic used below; only provably disjoint faces skip clip.
        world_radius = radius*(abs(cosine)+abs(sine))
        padding = 8*np.finfo(np.float32).eps*max(position_scale, np.abs(origin).max(), radius)
        volume_lower = origin+np.array([-world_radius, -world_radius, z0])-padding
        volume_upper = origin+np.array([world_radius, world_radius, z1])+padding
        candidates = np.flatnonzero(np.all(upper >= volume_lower, axis=1) & np.all(lower <= volume_upper, axis=1))
        for index in candidates:
            index = int(index)
            if index in hit:
                continue
            face = faces[index]
            polygon = [vertices[i]-offset for i in face]
            if max(p.z for p in polygon) < z0 or min(p.z for p in polygon) > z1:
                continue
            polygon = [Vector((cosine*p.x+sine*p.y, -sine*p.x+cosine*p.y, p.z)) for p in polygon]
            if any(min(p[a]*sign for p in polygon) > radius for a, sign in [(0, 1), (0, -1), (1, 1), (1, -1)]):
                continue
            for normal, constant in planes:
                if not polygon:
                    break
                polygon = clip(polygon, normal, constant)
            if len(polygon) >= 3 and (polygon[1]-polygon[0]).cross(polygon[2]-polygon[0]).length > 1e-8:
                hit.add(index)
    return len(hit)


def load(filename, source=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source:
        bpy.ops.wm.stl_import(filepath=str(filename))
    else:
        bpy.ops.import_scene.gltf(filepath=str(filename))
    bpy.context.view_layer.update()
    vertices, faces = [], []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        start = len(vertices)
        vertices += [obj.matrix_world @ vertex.co * (1 if source else 35) for vertex in obj.data.vertices]
        obj.data.calc_loop_triangles()
        faces += [tuple(start+i for i in face.vertices) for face in obj.data.loop_triangles]
    return vertices, faces, BVHTree.FromPolygons(vertices, faces, all_triangles=True)


def surface_drift(native, candidate, before, after):
    """Measure both surfaces without amplifying error along a grazing ray."""
    return max(candidate.find_nearest(before)[3], native.find_nearest(after)[3])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    recipe_index = json.loads((ROOT/'scripts/maps/majestic-recipes.json').read_text())
    recipe = json.loads((ROOT/'scripts/maps'/recipe_index[args.code]).read_text())
    settings = recipe['frameFit']
    if recipe['tileType'] != 'frame' or not recipe['preserveNativeMount']:
        raise ValueError('Reviewed native frame required')
    row = next(x for x in json.loads((BASE/'manifest.json').read_text()) if x['code'] == args.code)
    directory = BASE/'optimized-review'/args.code
    native_vertices, native_faces, native = load(ROOT/'models'/row['sourcePath'], True)
    result = {}
    for tier, filename in [('source', None), ('render', directory/'preview-model.glb'), ('lod', directory/'lod-preview-model.glb')]:
        vertices, faces, tree = (native_vertices, native_faces, native) if tier == 'source' else load(filename)
        if tier != 'source':
            shift = Vector((*row['mountCenterMM'], 0))
            vertices = [p+shift for p in vertices]
            tree = BVHTree.FromPolygons(vertices, faces, all_triangles=True)
        drift, ray_drift = [], []
        for x, y in settings['throughPointsMM']:
            if tree.ray_cast((x, y, row['max'][2]+10), (0, 0, -1), 1000)[0] is not None:
                raise ValueError(f'{tier}: native through-hole filled at {x},{y}')
        for z in settings['levelsMM']:
            for offset in settings['rayOffsetsMM']:
                for axis, sign in [(0, 1), (0, -1), (1, 1), (1, -1)]:
                    origin = Vector((0, offset, z) if axis == 0 else (offset, 0, z))
                    direction = Vector((sign, 0, 0) if axis == 0 else (0, sign, 0))
                    before = native.ray_cast(origin, direction, 100)[0]
                    after = tree.ray_cast(origin, direction, 100)[0]
                    if (before is None) != (after is None):
                        raise ValueError(f'{tier}: socket surface missing at {origin}')
                    if before is not None:
                        drift.append(surface_drift(native, tree, before, after))
                        ray_drift.append((before-after).length)
        if drift and max(drift) > settings['maxDriftMM']:
            raise ValueError(f'{tier}: socket drift {max(drift)}mm')
        fits = []
        for profile in settings['profiles']:
            for pose in profile.get('poses', [{'translationMM': [0, 0], 'rotation': 0}]):
                elevation = recipe['supportSlots'][0]['elevation']*35+profile['riseMM']
                pieces = profile.get('pinCentresMM', [[0, 0]])
                volumes = []
                angle = math.radians(pose['rotation'])
                for x, y in pieces:
                    translated = [pose['translationMM'][0]+math.cos(angle)*x-math.sin(angle)*y,
                                  pose['translationMM'][1]+math.sin(angle)*x+math.cos(angle)*y]
                    volumes += list(profile_volumes(profile, elevation, translated, pose['rotation']))
                count = collisions(vertices, faces, volumes)
                if count:
                    raise ValueError(f'{tier}: {profile["name"]} {pose}: {count} frame triangles intersect insertion')
                fits.append({'profile': profile['name'], 'pose': pose, 'collidingTriangles': count, 'allFrameTrianglesTested': len(faces)})
        result[tier] = {'throughHoles': len(settings['throughPointsMM']), 'maxNativeDriftMM': max(drift, default=0),
                        'maxRayHitDriftMM': max(ray_drift, default=0), 'fits': fits}
        print('MAJESTIC_FRAME_TIER_VALIDATED', args.code, tier, len(faces), max(drift, default=0), len(fits), flush=True)
    report_path = directory/'report.json'
    report = json.loads(report_path.read_text())
    report['frameFitChecks'] = result
    report.setdefault('validation', {})['nativeFrameFit'] = 'passed-whole-frame-profile-volumes-holes-and-surface-drift'
    report_path.write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    main()
