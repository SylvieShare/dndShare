"""Measure bare masonry surfaces for added-material masks, in cropped STL mm."""
import argparse
import json
from pathlib import Path
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def projected_grid(triangles, axes, value_axis, low, high, step, maximum):
    if any(high[i] < low[i] for i in range(2)):
        return {'low': low, 'step': step, 'size': [0, 0], 'values': []}
    size = [int(np.ceil((high[i]-low[i])/step))+1 for i in range(2)]
    empty = -np.inf if maximum else np.inf
    result = np.full((size[1], size[0]), empty, np.float32)
    for triangle in triangles:
        xy = (triangle[:, axes]-np.asarray(low))/step
        a, b, c = xy
        den = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den) < 1e-7:
            continue
        start = np.maximum(0, np.floor(xy.min(0)).astype(int))
        end = np.minimum(np.asarray(size)-1, np.ceil(xy.max(0)).astype(int))
        if np.any(start > end):
            continue
        xx, yy = np.meshgrid(np.arange(start[0], end[0]+1), np.arange(start[1], end[1]+1))
        wa = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        wb = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
        wc = 1-wa-wb
        mask = (wa >= -.001)&(wb >= -.001)&(wc >= -.001)
        values = wa*triangle[0, value_axis]+wb*triangle[1, value_axis]+wc*triangle[2, value_axis]
        target = result[start[1]:end[1]+1, start[0]:end[0]+1]
        operation = np.maximum if maximum else np.minimum
        operation(target, np.where(mask, values, empty), out=target)
    return {'low': low, 'step': step, 'size': size,
            'values': [round(float(v), 4) if np.isfinite(v) else None for v in result.ravel()]}


def prepare(code, minimum_wall_y=8, maximum_floor_z=15):
    rows = json.loads((ROOT/'models/collections/manifest.json').read_text())
    row = next(r for r in rows if r['collection'] == 'toxic-sewer' and r['code'] == code)
    dtype = np.dtype([('normal', '<f4', (3,)), ('v', '<f4', (3, 3)), ('a', '<u2')])
    triangles = np.memmap(ROOT/'models'/row['sourcePath'], dtype=dtype, mode='r', offset=84,
                          shape=(row['triangles'],))['v'].copy()
    triangles[:, :, 2] -= row['cutHeight']
    normal = np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0])
    normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-12)
    centres = triangles.mean(1)
    floor = triangles[(triangles[:, :, 2].max(1) < maximum_floor_z)&(normal[:, 2] > .1)]
    wall = triangles[(centres[:, 2] > 14.25)&(centres[:, 1] > minimum_wall_y)&(normal[:, 1] < -.1)]
    low, high = row['min'][:2], row['max'][:2]
    result = {'code': code, 'sourceSHA256': row['sourceSHA256'], 'minimumWallYMM': minimum_wall_y,
              'maximumFloorZMM': maximum_floor_z,
              'floor': projected_grid(floor, [0, 1], 2, low, high, .2, True),
              'wall': projected_grid(wall, [0, 2], 1, [low[0], 14.25],
                                     [high[0], row['max'][2]-row['cutHeight']], .2, False)}
    directory = ROOT/'models/collections/toxic-sewer/references'
    directory.mkdir(exist_ok=True)
    file = directory/(code+'.json')
    file.write_text(json.dumps(result, separators=(',', ':'))+'\n')
    print('TOXIC_SEWER_REFERENCE', code, len(floor), len(wall), file, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    parser.add_argument('--minimum-wall-y', type=float, default=8)
    parser.add_argument('--maximum-floor-z', type=float, default=15)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    prepare(args.code, args.minimum_wall_y, args.maximum_floor_z)
