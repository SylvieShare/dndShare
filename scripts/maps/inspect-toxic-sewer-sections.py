"""Inspect actual source cross-sections; measurements and plots stay in models/."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def section(vertices, axis, value):
    triangles = vertices[(vertices[:, :, axis].min(1) <= value)&
                         (vertices[:, :, axis].max(1) >= value)]
    axes = [i for i in range(3) if i != axis]
    parts = []
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        crossing = triangles[(triangles[:, a, axis] < value) != (triangles[:, b, axis] < value)]
        t = (value-crossing[:, a, axis])/(crossing[:, b, axis]-crossing[:, a, axis])
        parts.append((crossing[:, a]+(crossing[:, b]-crossing[:, a])*t[:, None])[:, axes])
    return np.concatenate(parts), axes


def inspect(code, axis, values):
    rows = json.loads((ROOT/'models/collections/manifest.json').read_text())
    row = next(r for r in rows if r['collection'] == 'toxic-sewer' and r['code'] == code)
    dtype = np.dtype([('n', '<f4', (3,)), ('v', '<f4', (3, 3)), ('a', '<u2')])
    vertices = np.memmap(ROOT/'models'/row['sourcePath'], dtype=dtype, mode='r', offset=84,
                         shape=(row['triangles'],))['v'].copy()
    vertices[:, :, 2] -= row['cutHeight']
    output = ROOT/'models/collections/toxic-sewer/measurements'/code.replace(' ', '_')
    output.mkdir(parents=True, exist_ok=True)
    measurements = {'code': code, 'sourceSHA256': row['sourceSHA256'], 'cutHeight': row['cutHeight'],
                    'coordinateSystem': 'Original STL millimetres minus cutHeight on Z', 'sections': []}
    for value in values:
        points, axes = section(vertices, axis, value)
        if not len(points):
            continue
        low = np.floor(points.min(0)/5)*5-5
        high = np.ceil(points.max(0)/5)*5+5
        scale = 700/max(high-low)
        image = Image.new('RGB', (800, 800), (242, 242, 235))
        draw = ImageDraw.Draw(image)
        def pixel(point):
            return (50+(point[0]-low[0])*scale, 750-(point[1]-low[1])*scale)
        for i in range(2):
            for coordinate in np.arange(low[i], high[i]+1, 5):
                p = low.copy(); p[i] = coordinate
                q = high.copy(); q[i] = coordinate
                draw.line((*pixel(p), *pixel(q)), fill=(190, 190, 190))
                label = pixel(p)
                draw.text((label[0]-5, 755) if i == 0 else (5, label[1]-5), str(int(coordinate)), fill='black')
        for p in points:
            x, y = pixel(p)
            draw.ellipse((x-1, y-1, x+1, y+1), fill=(35, 75, 35))
        name = 'XYZ'[axis]
        draw.text((40, 10), f'{code}; {name}={value} mm; axes '+''.join('XYZ'[i] for i in axes), fill='black')
        image.save(output/f'{name}-{value:g}.png')
        measurements['sections'].append({'axis': name, 'value': value, 'axes': axes,
                                         'min': points.min(0).tolist(), 'max': points.max(0).tolist(),
                                         'points': points.tolist()})
        print('SECTION', code, name, value, 'bounds', points.min(0).round(4), points.max(0).round(4))
    (output/'sections.json').write_text(json.dumps(measurements, separators=(',', ':'))+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    parser.add_argument('--axis', choices=['x', 'y', 'z'], default='z')
    parser.add_argument('--values', nargs='+', type=float, required=True)
    args = parser.parse_args()
    inspect(args.code, 'xyz'.index(args.axis), args.values)
