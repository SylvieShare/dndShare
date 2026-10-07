"""Index the provided Majestic Highlands archive without changing other packs."""
from pathlib import Path
import hashlib
import json
import re
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'models/collections/majestic-highlands'
DTYPE = np.dtype([('n', '<f4', (3,)), ('v', '<f4', (3, 3)), ('a', '<u2')])


def section_bounds(triangles, plane):
    z = triangles[:, :, 2]
    crossing = triangles[(z.min(1) < plane) & (z.max(1) > plane)]
    points = []
    for i, j in [(0, 1), (1, 2), (2, 0)]:
        a, b = crossing[:, i], crossing[:, j]
        mask = (a[:, 2] < plane) != (b[:, 2] < plane)
        a, b = a[mask], b[mask]
        points.append(a + (b-a)*((plane-a[:, 2])/(b[:, 2]-a[:, 2]))[:, None])
    result = np.concatenate(points)
    if not len(result):
        raise ValueError('No mounting section')
    return result.min(0), result.max(0)


def main():
    source = BASE / 'source'
    canonical = sorted(p for p in source.rglob('*.stl')
                       if '-UNS-' in p.parent.name or p.parent.name == 'Unsupported')
    rows = []
    for original in canonical:
        match = re.fullmatch(r'(MH-\d{3})-(.+)', original.stem)
        code, name = match.groups() if match else (original.stem, original.stem)
        path = original
        # This supplied NL archive swaps the shapes of 012/013; canonical UNS labels match the PDF.
        if match and code not in {'MH-012','MH-013'}:
            variants = list(source.rglob(code + '-NL-' + name + '.stl'))
            if len(variants) > 1:
                variants = [p for p in variants if '(1)' not in p.parent.name]
            if variants:
                path = variants[0]
        with path.open('rb') as f:
            f.seek(80)
            count = struct.unpack('<I', f.read(4))[0]
        if path.stat().st_size != 84 + 50*count:
            raise ValueError('Unexpected STL format: ' + str(path))
        triangles = np.memmap(path, dtype=DTYPE, mode='r', offset=84,
                              shape=(count,))['v']
        low, high = triangles.min((0, 1)), triangles.max((0, 1))
        frame = '-06-' in original.parent.name or original.parent.name == 'Unsupported'
        plane = min(float(high[2])-.1, .1 if frame else 10.0)
        bottom, top = section_bounds(triangles, plane)
        spans = top[:2]-bottom[:2]
        size = [max(1, int(round(float(s)/35))) for s in spans]
        with path.open('rb') as f:
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
        rows.append({
            'collection': 'majestic-highlands', 'collectionName': 'Majestic Highlands XL',
            'code': code, 'sourceName': name, 'sourcePath': str(path.relative_to(ROOT/'models')),
            'sourceSHA256': digest, 'sourceBytes': path.stat().st_size, 'triangles': count,
            'min': low.astype(float).tolist(), 'max': high.astype(float).tolist(),
            'width': size[0], 'height': size[1],
            'mountCenterMM': ((bottom[:2]+top[:2])/2).astype(float).tolist(),
            'measurementPlaneMM': plane,
            'footprintReviewed': False,
            'sourceVariant': 'no-logo' if '-NL-' in path.name else 'unsupported',
            'group': original.parent.name,
            'reviewStatus': 'pending',
        })
        print('INDEXED', code, size, flush=True)
    rows.sort(key=lambda row: (not row['code'].startswith('MH-'), row['code']))
    (BASE/'manifest.json').write_text(json.dumps(rows, indent=2)+'\n')
    print('MAJESTIC_INVENTORY', len(rows), 'models', flush=True)


if __name__ == '__main__':
    main()
