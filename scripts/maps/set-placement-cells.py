#!/usr/bin/env python3
"""Initialize missing logical cells through MCP, without publishing assets."""
import argparse
import importlib.util
import json
import math
from pathlib import Path

spec = importlib.util.spec_from_file_location('mcp_grouping', Path(__file__).with_name('apply-model-grouping.py'))
mcp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mcp)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    models = mcp.tool('map_tile_models_list', {})
    changes = []
    for model in models:
        points = model['placementPoints']
        if not any(p.get('cell') is None for p in points):
            continue
        cells = [p.get('cell') or {'x': min(model['width']-1, max(0, math.floor(p['x']))),
                                  'y': min(model['height']-1, max(0, math.floor(p['y'])))} for p in points]
        changes.append({'definitionId': model['definitionId'], 'width': model['width'], 'height': model['height'], 'expected': points, 'cells': cells})
    if args.apply and changes:
        for start in range(0, len(changes), 1000):
            mcp.tool('map_tile_model_placement_cells_update', {'models': changes[start:start+1000]})
        after = {m['definitionId']: m for m in mcp.tool('map_tile_models_list', {})}
        for change in changes:
            old = next(m for m in models if m['definitionId'] == change['definitionId'])
            expected = {**old, 'placementPoints': [{**p, 'cell': c} for p, c in zip(change['expected'], change['cells'])]}
            if after[change['definitionId']] != expected:
                raise RuntimeError('Concurrent metadata change or cell verification failed: '+change['definitionId'])
    print(json.dumps({'models': len(models), 'initialized' if args.apply else 'wouldInitialize': len(changes), 'points': sum(len(c['cells']) for c in changes)}))


if __name__ == '__main__':
    main()
