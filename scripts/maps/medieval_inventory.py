"""Read canonical Medieval Town Vol.1 sources; keep all model bytes ignored."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/medieval-town-vol1'
DTYPE = np.dtype([('normal', '<f4', (3,)), ('v', '<f4', (3, 3)), ('attr', '<u2')])


def extract(archive, sevenzip):
    packages = BASE/'packages'
    packages.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(sevenzip), 'x', '-y', '-bd', '-bb0', f'-o{packages}', str(archive)], check=True)
    rows = []
    for package in sorted(packages.rglob('*.zip')):
        dest = BASE/'variants'/package.stem
        with zipfile.ZipFile(package) as z:
            files = [i for i in z.infolist() if not i.is_dir()]
            for entry in files:
                if not (dest/entry.filename).resolve().is_relative_to(dest.resolve()):
                    raise ValueError('Unsafe archive path')
            if not (dest/'.complete').exists():
                dest.mkdir(parents=True, exist_ok=True)
                z.extractall(dest)
                (dest/'.complete').write_text('ok\n')
            rows.append({'archive': package.name, 'files': len(files), 'bytes': sum(i.file_size for i in files)})
    (BASE/'extraction.json').write_text(json.dumps(rows, indent=2)+'\n')


def inventory():
    paths = list((BASE/'variants/MT1-Unsupported').rglob('*.stl'))
    paths += list((BASE/'variants/MT1-Bonus Blocks/Bonus Blocks-Unsupported').rglob('*.stl'))
    rows = []
    seen = set()
    for path in paths:
        code, name = re.fullmatch(r'(MT1-\d+)-(.*)', path.stem).groups()
        if code in seen:
            raise ValueError('Duplicate source ID '+code)
        seen.add(code)
        with path.open('rb') as f:
            f.seek(80)
            count = struct.unpack('<I', f.read(4))[0]
            f.seek(0)
            checksum = hashlib.file_digest(f, 'sha256').hexdigest()
        size = path.stat().st_size
        if size != 84+count*50:
            raise ValueError('Expected binary STL: '+str(path))
        triangles = np.memmap(path, dtype=DTYPE, mode='r', offset=84, shape=(count,))['v']
        rows.append({'collection': 'medieval-town-vol1', 'collectionName': 'Medieval Town Vol.1',
                     'code': code, 'sourceName': name, 'sourcePath': str(path.relative_to(ROOT/'models')),
                     'sourceSHA256': checksum, 'sourceBytes': size, 'triangles': count,
                     'min': triangles.min((0, 1)).tolist(), 'max': triangles.max((0, 1)).tolist()})
    rows.sort(key=lambda r: r['code'])
    if len(rows) != 163:
        raise ValueError(f'Incomplete canonical inventory: {len(rows)} of 163')
    (BASE/'inventory.json').write_text(json.dumps(rows, indent=2)+'\n')
    print('MEDIEVAL_INVENTORY', len(rows), sum(r['sourceBytes'] for r in rows), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--sevenzip', type=Path, default=Path('/private/tmp/dndshare-7zip/7zz'))
    args = parser.parse_args()
    if args.archive:
        extract(args.archive, args.sevenzip)
    inventory()
