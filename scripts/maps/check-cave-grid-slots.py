"""Check every native grid socket, through-hole and fitted insertion volume."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def clip(poly, normal, constant):
    result = []
    for i, a in enumerate(poly):
        b = poly[(i + 1) % len(poly)]
        da, db = normal.dot(a) + constant, normal.dot(b) + constant
        if da <= 0:
            result.append(a)
        if (da < 0) != (db < 0):
            result.append(a + (b - a) * (da / (da - db)))
    return result


def surface(tree, origin, direction, required=True):
    hit = tree.ray_cast(Vector(origin), Vector(direction), 1000)
    if required and hit[0] is None:
        raise ValueError(f'Missing socket surface at {origin}, {direction}')
    return hit[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    report = json.loads(args.report.read_text())
    model = report['model']
    if model['tileType'] != 'frame' or model['mountDepth'] != 0 or report['cutHeight'] != 0:
        raise ValueError('An individually reviewed native grid without a mounting cut is required')
    source = Path(report['sourcePath'])
    if hashlib.sha256(source.read_bytes()).hexdigest() != model['assets']['source']['sha256']:
        raise ValueError('Verified native grid source required')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(source))
    obj = bpy.context.object
    for vertex in obj.data.vertices:
        vertex.co.x += report['sourceShiftMM'][0]
        vertex.co.y += report['sourceShiftMM'][1]
    obj.data.update()
    native = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    checks = {}
    for tier in ['render', 'lod']:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        name = 'preview-model.glb' if tier == 'render' else 'lod-preview-model.glb'
        bpy.ops.import_scene.gltf(filepath=str(args.report.parent / name))
        bpy.context.view_layer.update()
        vertices, faces = [], []
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH':
                continue
            start = len(vertices)
            vertices += [obj.matrix_world @ v.co * 35 for v in obj.data.vertices]
            faces += [tuple(start + i for i in p.vertices) for p in obj.data.polygons]
        tree = BVHTree.FromPolygons(vertices, faces, all_triangles=True)
        slots = []
        for slot in model['supportSlots']:
            if slot['width'] != 1 or slot['height'] != 1:
                raise ValueError('Inspect each native grid cell separately')
            centre = Vector(((slot['x'] + .5 - model['width'] / 2 - model['placementOffset'][0]) * 35,
                             (model['height'] / 2 - slot['y'] - .5 + model['placementOffset'][1]) * 35, 0))
            top = slot['elevation'] * 35
            rise = slot.get('insertionRise', 0) * 35
            if not 0 < rise <= 3.5:
                raise ValueError('A measured insertion rise is required')
            for t in [native, tree]:
                if surface(t, centre + Vector((0, 0, top + 10)), (0, 0, -1), False) is not None:
                    raise ValueError('Native central through-hole was filled')
            drift = []
            for z in [.1, 5, 10, 15, 20, 23, 23.5, 24, 24.5, 25]:
                if z >= top:
                    continue
                for direction in [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)]:
                    origin = centre + Vector((0, 0, z))
                    a = surface(native, origin, direction)
                    b = surface(tree, origin, direction)
                    drift.append((a - b).length)
            for x, y in [(10.5, 0), (-10.5, 0), (0, 10.5), (0, -10.5)]:
                origin = centre + Vector((x, y, top + 10))
                a = surface(native, origin, (0, 0, -1))
                b = surface(tree, origin, (0, 0, -1))
                drift.append((a - b).length)
            if max(drift) > .25:
                raise ValueError(f'{tier}: native socket drift {max(drift)}mm')
            fits = []
            for depth, bottom in [(5.29571, 11.375), (9.94, 7.4)]:
                slope = (17.15 - bottom) / depth
                planes = [(Vector((0, 0, -1)), 0), (Vector((0, 0, 1)), -depth + .03)]
                for axis, sign in [(0, 1), (0, -1), (1, 1), (1, -1)]:
                    normal = Vector((0, 0, -slope))
                    normal[axis] = sign
                    planes.append((normal, -bottom - .05))
                collisions = 0
                for face in faces:
                    poly = [vertices[i] - centre - Vector((0, 0, top + rise - depth)) for i in face]
                    for normal, constant in planes:
                        if not poly:
                            break
                        poly = clip(poly, normal, constant)
                    if len(poly) >= 3 and (poly[1] - poly[0]).cross(poly[2] - poly[0]).length > 1e-8:
                        collisions += 1
                if collisions:
                    raise ValueError(f'{tier}: {collisions} grid triangles inside insertion volume')
                fits.append({'mountDepthMM': depth, 'bottomWidthMM': bottom * 2, 'allFrameTrianglesTested': len(faces), 'collidingTriangles': collisions})
            slots.append({'x': slot['x'], 'y': slot['y'], 'sourceRays': len(drift), 'maxNativeDriftMM': max(drift), 'throughHole': True, 'insertionRiseMM': rise, 'fits': fits})
        checks[tier] = slots
    report['gridSocketChecks'] = checks
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print('NATIVE_GRID_SOCKET_CHECKS', checks, flush=True)


if __name__ == '__main__':
    main()
