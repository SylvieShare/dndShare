"""Source depth for a manually reviewed, occlusion-aware bone silhouette."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/maps'))
from tile_mesh import crop

DIRECTIONS = {
    'top': Vector((0, -.01, 5)),
    'reverse': Vector((2, -2.85, 2.45)),
    'outside': Vector((2, 2.85, 2.45)),
    'inside': Vector((-2, -2.85, 2.45)),
}


def camera_frame(directory, view, fit_view):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(directory / 'preview-model.glb'))
    bpy.context.view_layer.update()
    bounds = [
        obj.matrix_world @ Vector(corner) * 35
        for obj in bpy.context.scene.objects if obj.type == 'MESH'
        for corner in obj.bound_box
    ]
    low = Vector(tuple(min(p[i] for p in bounds) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in bounds) for i in range(3)))
    centre = (low + high) / 2
    fit = (-DIRECTIONS[fit_view]).to_track_quat('-Z', 'Y').inverted()
    projected = [fit @ (p - centre) for p in bounds]
    scale = max(
        max(p.x for p in projected) - min(p.x for p in projected),
        max(p.y for p in projected) - min(p.y for p in projected),
        3.5,
    ) * 1.18
    rotation = (-DIRECTIONS[view]).to_track_quat('-Z', 'Y')
    return {
        'centre': centre,
        'right': rotation @ Vector((1, 0, 0)),
        'up': rotation @ Vector((0, 1, 0)),
        'outward': rotation @ Vector((0, 0, 1)),
        'scaleMM': scale,
    }


def source_tree(report):
    source = Path(report['sourcePath'])
    expected = report['model']['assets']['source']['sha256']
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise ValueError('Verified original STL required')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(source))
    obj = bpy.context.object
    crop(obj, report['cutHeight'])
    for vertex in obj.data.vertices:
        vertex.co.x += report['sourceShiftMM'][0]
        vertex.co.y += report['sourceShiftMM'][1]
    obj.data.update()
    bpy.context.view_layer.update()
    return BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())


def depth_field(tree, frame, size):
    depth = np.full((size, size), np.nan, dtype='<f4')
    centre, right, up, outward = [
        frame[key] for key in ['centre', 'right', 'up', 'outward']
    ]
    scale = frame['scaleMM']
    for y in range(size):
        for x in range(size):
            origin = (
                centre + right * ((x + .5) / size - .5) * scale
                + up * (.5 - (y + .5) / size) * scale + outward * 200
            )
            hit = tree.ray_cast(origin, -outward, 400)
            if hit[0] is not None:
                depth[y, x] = outward.dot(hit[0] - centre)
        if y % 256 == 0:
            print('BONE_VIEW_ROW', y, size, flush=True)
    return depth.tobytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--view', choices=DIRECTIONS, required=True)
    parser.add_argument('--fit', choices=DIRECTIONS, default='outside')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    report = json.loads(args.report.read_text())
    frame = camera_frame(args.report.parent, args.view, args.fit)
    size = 1024
    payload = depth_field(source_tree(report), frame, size)
    out = (ROOT / 'models/collections/lost-cave/bone-views'
           / report['model']['sourceCode'] / args.view)
    out.mkdir(parents=True, exist_ok=True)
    spec = {
        'sourceSHA256': report['model']['assets']['source']['sha256'],
        'fieldSHA256': hashlib.sha256(payload).hexdigest(),
        'cutHeight': report['cutHeight'],
        'sourceShiftMM': report['sourceShiftMM'],
        **{key: list(value) if isinstance(value, Vector) else value
           for key, value in frame.items()},
        'size': size,
        'view': args.view,
        'fit': args.fit,
    }
    (out / 'depth.bin').write_bytes(payload)
    (out / 'reference.json').write_text(json.dumps(spec, indent=2) + '\n')
    print('BONE_VIEW_READY', report['model']['sourceCode'], args.view,
          len(payload), flush=True)


if __name__ == '__main__':
    main()
