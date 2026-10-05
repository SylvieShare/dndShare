"""Measure the remaining insertion taper below the body of canonical STL tiles.

Source files are read-only. Measurements/diagnostics stay in ignored models/.
Coordinates are converted to the same 35 mm cell units as prepared GLBs.
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections'
DTYPE = np.dtype([('normal', '<f4', (3,)), ('v', '<f4', (3, 3)), ('attr', '<u2')])


def measure(row):
    triangles = np.memmap(ROOT/'models'/row['sourcePath'], dtype=DTYPE,
                          mode='r', offset=84, shape=(row['triangles'],))
    vertices = triangles['v'].reshape(-1, 3)
    cut = row['cutHeight']
    limit = cut + (20 if row['collection']=='basic-elements' else 10)
    base = vertices[(vertices[:, 2]>=cut-.001)&(vertices[:, 2]<=limit)]
    plane = cut+.1
    v = triangles['v']
    crossing = v[(v[:, :, 2].min(1)<plane)&(v[:, :, 2].max(1)>plane)]
    points = []
    for i, j in [(0, 1), (1, 2), (2, 0)]:
        a, b = crossing[:, i], crossing[:, j]
        mask = (a[:, 2]<plane)!=(b[:, 2]<plane)
        a, b = a[mask], b[mask]
        points.append(a+(b-a)*((plane-a[:, 2])/(b[:, 2]-a[:, 2]))[:, None])
    bottom = np.concatenate(points)
    if not len(bottom):
        bottom = base[base[:, 2]<=cut+.5]
    if not len(base) or not len(bottom):
        raise ValueError('No base geometry: '+row['code'])
    low, high = base.min(0), base.max(0)
    spans = high[:2]-low[:2]
    ratios = (bottom.max(0)[:2]-bottom.min(0)[:2])/spans
    # Structural rims and borders already start at their base, without a peg.
    if min(ratios)>.86:
        return 0, {'bottomRatios': ratios.tolist()}
    levels = []
    center = (low+high)/2
    for axis in [0, 1]:
        edge = base[np.abs(base[:, axis]-center[axis])>=spans[axis]/2-.05]
        levels.append(float(edge[:, 2].min()))
    depth = max(0, max(levels)-cut)
    if depth>15 or depth>row['max'][2]-cut:
        raise ValueError(f'Unexpected insertion depth {row["code"]}: {depth}')
    return round(depth/35, 6), {'bodyPlaneMM': max(levels), 'bottomRatios': ratios.tolist()}


if __name__ == '__main__':
    rows = json.loads((BASE/'manifest.json').read_text())
    measurements = []
    for row in rows:
        depth, evidence = measure(row)
        measurements.append({'collection': row['collection'], 'sourceCode': row['code'],
            'sourceName': row['sourceName'], 'sourceSHA256': row['sourceSHA256'],
            'mountDepth': depth, 'cutHeightMM': row['cutHeight'], **evidence})
        print('MOUNT', row['code'], depth, flush=True)
    (BASE/'mounts.json').write_text(json.dumps(measurements, ensure_ascii=False, indent=2)+'\n')
