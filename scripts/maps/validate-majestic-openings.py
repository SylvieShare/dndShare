"""Verify measured unobstructed passage rays in the sculpt and both final geometry tiers."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/majestic-highlands'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    index = json.loads((ROOT/'scripts/maps/majestic-recipes.json').read_text())
    recipe = json.loads((ROOT/'scripts/maps'/index[args.code]).read_text())
    checks = recipe.get('openingChecks', [])
    if not checks:
        raise ValueError('Individually measured opening checks required')
    row = next(x for x in json.loads((BASE/'manifest.json').read_text()) if x['code'] == args.code)
    directory = BASE/'optimized-review'/args.code
    results = []
    for tier, filename in [('source', ROOT/'models'/row['sourcePath']),
                           ('render', directory/'preview-model.glb'),
                           ('lod', directory/'lod-preview-model.glb')]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if tier == 'source':
            bpy.ops.wm.stl_import(filepath=str(filename))
        else:
            bpy.ops.import_scene.gltf(filepath=str(filename))
        bpy.context.view_layer.update()
        deps = bpy.context.evaluated_depsgraph_get()
        for check in checks:
            origin = Vector(check['originMM'])
            direction = Vector(check['direction'])
            distance = check['distanceMM']
            if distance <= 0 or direction.length == 0:
                raise ValueError('Positive distance and nonzero opening direction required')
            if tier != 'source':
                origin.x -= row['mountCenterMM'][0]
                origin.y -= row['mountCenterMM'][1]
                origin /= 35
                distance /= 35
            hit = bpy.context.scene.ray_cast(deps, origin, direction.normalized(), distance=distance)
            clear = not hit[0]
            if clear != check.get('clear', True):
                raise ValueError(f'{args.code} {tier} {check["name"]}: clear={clear}, expected {check.get("clear", True)}')
            results.append({'tier': tier, 'name': check['name'], 'clear': clear})
    path = directory/'report.json'
    report = json.loads(path.read_text())
    report['openingChecks'] = results
    report.setdefault('validation', {})['openingGeometry'] = 'passed'
    path.write_text(json.dumps(report, indent=2)+'\n')
    print('MAJESTIC_OPENINGS_VALIDATED', args.code, len(results), flush=True)


if __name__ == '__main__':
    main()
