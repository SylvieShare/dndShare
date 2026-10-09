"""Check each fitted pad against the accepted native LC-060 socket geometry."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--frame', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
report = json.loads(args.report.read_text())
frame = json.loads((args.frame / 'report.json').read_text())['model']
slot = frame['supportSlots'][0]['elevation'] * 35
depth = report['model']['mountDepth'] * 35
checks = {}
for tier in ['render', 'lod']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name = 'preview-model.glb' if tier == 'render' else 'lod-preview-model.glb'
    bpy.ops.import_scene.gltf(filepath=str(args.report.parent / name))
    points = [obj.matrix_world @ vertex.co
              for obj in bpy.context.scene.objects if obj.type == 'MESH'
              and any(m and m.name.startswith('Simple insertion pegs')
                      for m in obj.data.materials)
              for vertex in obj.data.vertices]
    pads = report['tiers'][tier]['padBounds']
    centres = [Vector(((p['top']['min'][0] + p['top']['max'][0]) / 2,
                       -(p['top']['min'][1] + p['top']['max'][1]) / 2, 0))
               for p in pads]
    groups = [[] for _ in centres]
    for point in points:
        i = min(range(len(centres)), key=lambda k:
                (point.x - centres[k].x)**2 + (point.y - centres[k].y)**2)
        groups[i].append(point - centres[i])
    bounds = []
    for group in groups:
        low = min(p.z * 35 for p in group)
        high = max(p.z * 35 for p in group)
        assert abs(high - low - depth) < .002
        lower = [p for p in group if abs(p.z * 35 - low) < .002]
        upper = [p for p in group if abs(p.z * 35 - high) < .002]
        radii = [(max(p[a] * sign * 35 for p in lower),
                  max(p[a] * sign * 35 for p in upper))
                 for a, sign in [(0, 1), (0, -1), (1, 1), (1, -1)]]
        bounds.append((low, high, radii))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.frame / name))
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    clearances = []
    for low, high, radii in bounds:
        for z in [23.83, 24.5, 25, 25.5, 26, 27, 28, 29.05]:
            t = (z - slot + depth - low) / (high - low)
            if t < 0 or t > 1:
                continue
            for i, (axis, sign) in enumerate([(0, 1), (0, -1), (1, 1), (1, -1)]):
                radius = radii[i][0] + (radii[i][1] - radii[i][0]) * t
                direction = Vector((sign if axis == 0 else 0,
                                    sign if axis == 1 else 0, 0))
                hit = bpy.context.scene.ray_cast(graph, Vector((0, 0, z / 35)),
                                                 direction, distance=2)
                if hit[0]:
                    clearances.append(hit[1][axis] * sign * 35 - radius)
    floor = bpy.context.scene.ray_cast(graph, Vector((0, 0, slot / 35)),
                                       Vector((0, 0, -1)), distance=2)
    assert floor[0]
    floor_clearance = slot - depth - floor[1].z * 35
    assert floor_clearance > 10
    assert min(clearances) > .05, (tier, min(clearances))
    checks[tier] = {'pads': len(pads), 'minWallClearanceMM': min(clearances),
                    'floorClearanceMM': floor_clearance}
report['slotFitChecks'] = checks
args.report.write_text(json.dumps(report, indent=2) + '\n')
print('FITTED_SLOT_CHECK', report['model']['sourceCode'], checks, flush=True)
