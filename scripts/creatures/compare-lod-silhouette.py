#!/usr/bin/env python3
"""Compare exact render/LOD GLBs with 17 shared orthographic cameras."""
import argparse
import json
from pathlib import Path

from lod_silhouette import compare, contact_sheet, geometry, policy
from trellis_checkpoint import write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='Output report folder; defaults also resolve GLBs here')
    parser.add_argument('--render', type=Path)
    parser.add_argument('--lod', type=Path)
    parser.add_argument('--recipe', type=Path)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text()) if args.recipe else {}
    settings = policy(recipe.get('lodSilhouette'))
    reference = geometry(args.render or args.directory/'model.glb')
    candidate = geometry(args.lod or args.directory/'model-lod.glb')
    results, images = compare(reference, candidate, settings)
    passed = all(result['passed'] for result in results)
    report = {'schema': 1, 'mode': 'opaque-geometry', 'passed': passed, 'policy': settings,
              'assetHashes': {'render': reference[2], 'lod': candidate[2]},
              'minIoU': min(r['iou'] for r in results),
              'maxDistancePixels': max(r['maxDistancePixels'] for r in results), 'views': results}
    args.directory.mkdir(parents=True, exist_ok=True)
    contact_sheet(results, images).save(args.directory/'lod-silhouette.png')
    write_json(args.directory/'lod-silhouette.json', report)
    print(json.dumps({'passed': passed, 'views': len(results), 'minIoU': report['minIoU'],
                      'maxDistancePixels': report['maxDistancePixels'],
                      'failedViews': [r['name'] for r in results if not r['passed']]}))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
