"""Compare floor heights and require upward normals in the rebuilt model."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def heights(file, model, require_up=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(file))
    graph = bpy.context.evaluated_depsgraph_get()
    result, normals = [], []
    for point in model['placementPoints']:
        origin = Vector((
            point['x'] - model['width'] / 2 - model['placementOffset'][0],
            model['height'] / 2 - point['y'] + model['placementOffset'][1],
            model['maxHeight'] + 2,
        ))
        hit = bpy.context.scene.ray_cast(graph, origin, Vector((0, 0, -1)))
        if not hit[0] or hit[1].z <= 0:
            raise ValueError('Placement point has no upper surface')
        if require_up and hit[2].z <= 0:
            raise ValueError('Rebuilt placement surface has inverted normals')
        result.append(hit[1].z)
        normals.append(hit[2].z)
    return result, normals


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    report = json.loads(args.report.read_text())
    directory = args.report.parent
    checks = {}
    for tier in ['render', 'lod']:
        # Existing assets can contain reversed faces. Their geometric height
        # remains the baseline; every new standable face must point upwards.
        before, before_normals = heights(
            directory / (tier + '-input.glb'),
            report.get('originalModel', report['model']), require_up=False,
        )
        after, after_normals = heights(
            directory / ('preview-model.glb' if tier == 'render'
                         else 'lod-preview-model.glb'), report['model'],
        )
        expected = (
            [p['elevation'] for p in report['model']['placementPoints']]
            if report.get('geometryCorrection') else before
        )
        drift = max((abs(a - b) for a, b in zip(expected, after)), default=0)
        if drift > .03:
            raise ValueError('Placement surface changed by more than1.05 mm')
        checks[tier] = {
            'points': len(after), 'maxDriftMM': drift * 35,
            'before': before, 'after': after,
            'beforeNormalZ': before_normals, 'afterNormalZ': after_normals,
            'repairedInvertedNormals': sum(n <= 0 for n in before_normals),
        }
        if report.get('geometryCorrection'):
            checks[tier]['expectedCorrectedHeights'] = expected
    report['placementChecks'] = checks
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print('CAVE_PLACEMENT', checks, flush=True)


if __name__ == '__main__':
    main()
