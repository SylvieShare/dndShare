"""Bounded, checked source restoration into a new directory; never executes sources."""
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile

MAX_FILE = 512*1024**2
MAX_EXPANDED = 2*1024**3


class BoundedReader(io.RawIOBase):
    def __init__(self, source):
        self.source, self.remaining = source, MAX_EXPANDED

    def read(self, size=-1):
        data = self.source.read(min(self.remaining+1, size) if size >= 0 else self.remaining+1)
        self.remaining -= len(data)
        if self.remaining < 0: raise ValueError('Archive exceeds expanded byte limit')
        return data


def source_path(name):
    return (bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_./-]{0,199}',name))
        and name != 'archive-manifest.json' and '..' not in name
        and str(Path(name)) == name and not any(p.startswith('.') for p in Path(name).parts)
        and Path(name).suffix in {'.glb','.blend','.png','.jpg','.webp','.json','.txt','.py','.mjs','.md'})


def restore_archive(file, destination):
    file, destination = Path(file), Path(destination)
    if destination.exists(): raise ValueError('Restore destination must not exist')
    if file.stat().st_size > MAX_FILE: raise ValueError('Archive exceeds compressed byte limit')
    destination.parent.mkdir(parents=True,exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.miniature-restore-',dir=destination.parent))
    try:
        with gzip.open(file,'rb') as compressed, tarfile.open(fileobj=BoundedReader(compressed),mode='r|') as archive:
            first = archive.next()
            if not first or not first.isfile() or first.name != 'archive-manifest.json' or not 0 < first.size <= 256*1024:
                raise ValueError('Missing archive manifest')
            manifest = json.load(archive.extractfile(first))
            listed = manifest['files']
            if manifest.get('schema') != 1 or manifest.get('stage') not in {'native','ready'} or not 0 < len(listed) <= 256:
                raise ValueError('Unsupported archive manifest')
            expected = {}
            for f in listed:
                if not source_path(f['path']) or f['path'] in expected or not isinstance(f['size'],int) or not 0 <= f['size'] <= MAX_FILE or not re.fullmatch('[0-9a-f]{64}',f['sha256']):
                    raise ValueError('Invalid archive source metadata')
                expected[f['path']] = f
            required = {'recipe.json','inputs/miniature-reference.png','native/generated-original.glb'}
            if manifest['stage'] == 'ready':
                required |= {'baked/model.blend','final/model.glb','final/model-lod.glb','final/verification.json','final/lod-silhouette.json'}
            if not required <= expected.keys() or sum(f['size'] for f in listed) > MAX_EXPANDED:
                raise ValueError('Archive is incomplete or exceeds expanded byte limit')
            (staging/'archive-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
            while (member := archive.next()) is not None:
                f = expected.pop(member.name,None)
                if not f or not member.isfile() or member.size != f['size']:
                    raise ValueError('Archive contains an unexpected file or link')
                target = staging/member.name
                target.parent.mkdir(parents=True,exist_ok=True)
                hashed = hashlib.sha256()
                with archive.extractfile(member) as source, target.open('xb') as output:
                    for chunk in iter(lambda:source.read(1024*1024),b''):
                        output.write(chunk); hashed.update(chunk)
                if hashed.hexdigest() != f['sha256']: raise ValueError('Archive source checksum differs')
            if expected: raise ValueError('Archive is incomplete')
            # Force gzip checksum verification, with a bounded padding allowance.
            tail = compressed.read(65537)
            if len(tail) > 65536 or tail.strip(b'\0'): raise ValueError('Unexpected archive tail')
        if destination.exists(): raise ValueError('Restore destination appeared during validation')
        os.rename(staging,destination)
        return manifest
    finally:
        if staging.exists(): shutil.rmtree(staging)
