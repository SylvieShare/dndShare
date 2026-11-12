#!/usr/bin/env python3
"""Plan and prune immutable releases and expired compiled assets; never application data."""
import argparse
import base64
from contextlib import contextmanager
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import time
import urllib.request

SHA = re.compile(r'^[0-9a-f]{40}$')


def capture_manifest(root, port):
    """Convert the current slot's signed inventory before a format upgrade."""
    if port not in (8080, 8081):
        raise ValueError('Only local deployment ports are allowed')
    slot = (root / 'active').read_text(encoding='utf8').strip()
    if slot not in ('blue', 'green'):
        raise ValueError('Only a managed slot can be converted')
    directory = (root / 'slots' / slot).resolve(strict=True)
    if directory.parent != root / 'releases' or not SHA.fullmatch(directory.name):
        raise ValueError('Invalid active release')
    output = directory / 'frontend.sha256'
    if output.exists():
        return
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/frontend-updates/latest', timeout=5) as response:
        envelope = response.read(2 * 1024 * 1024 + 1)
    if len(envelope) > 2 * 1024 * 1024:
        raise ValueError('Manifest exceeds update limits')
    payload = json.loads(base64.b64decode(json.loads(envelope)['payload'], validate=True))
    if payload.get('commitSha') != directory.name:
        raise ValueError('Inventory belongs to a different release')
    lines = []
    for item in payload['files']:
        name, digest = item['path'], item['sha256']
        if not re.fullmatch(r'[A-Za-z0-9_./-]+', name) or name.startswith('/') or '..' in PurePosixPath(name).parts or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Invalid inventory entry')
        lines.append(f'{digest}  ./{name}\n')
    temporary = directory / 'frontend.sha256.next'
    temporary.write_text(''.join(lines), encoding='utf8')
    temporary.replace(output)


def pinned_releases(root):
    """Fail closed if slot/state references cannot be validated."""
    release_root = root / 'releases'
    active = (root / 'active').read_text(encoding='utf8').strip()
    previous = (root / 'previous').read_text(encoding='utf8').strip()
    if active not in ('blue', 'green') or previous not in ('', 'blue', 'green'):
        raise ValueError('Invalid deployment state; nothing may be pruned')
    pinned = set()
    for slot in ('blue', 'green'):
        link = root / 'slots' / slot
        if not link.exists():
            if slot in (active, previous):
                raise ValueError('Missing protected slot')
            continue
        target = link.resolve(strict=True)
        if target.parent != release_root or not SHA.fullmatch(target.name) or not target.is_dir():
            raise ValueError('Slot escapes immutable releases')
        if (target / 'commit').read_text(encoding='utf8').strip() != target.name:
            raise ValueError('Slot commit does not match its directory')
        pinned.add(target.name)
    return pinned


def protected_assets(root, pinned):
    names = set()
    for commit in pinned:
        manifest = root / 'releases' / commit / 'frontend.sha256'
        if not manifest.is_file() or manifest.is_symlink():
            return None  # Legacy previous slot: wait for manifests in both slots.
        for line in manifest.read_text(encoding='utf8').splitlines():
            digest, filename = line.split(maxsplit=1)
            filename = filename.lstrip('*').removeprefix('./')
            parts = PurePosixPath(filename).parts
            if not re.fullmatch(r'[0-9a-f]{64}', digest) or '\\' in filename or filename.startswith('/') or '..' in parts:
                raise ValueError('Unsafe frontend checksum manifest')
            if parts and parts[0] == 'static':
                names.add(PurePosixPath(*parts[1:]).as_posix())
    return names


def plan(root, assets, *, keep=5, asset_days=30, now=None):
    root, assets = Path(root).absolute(), Path(assets).absolute()
    if keep < 2 or asset_days < 7:
        raise ValueError('Retention must keep at least two releases and seven days of assets')
    if root.name != 'dndshare-deployment' or root.is_symlink() or root.resolve() != root:
        raise ValueError('Unexpected deployment root')
    expected_assets = root.parent / 'dndshare-frontend-assets' / 'static'
    if assets != expected_assets or assets.is_symlink() or assets.resolve() != assets:
        raise ValueError('Unexpected static cache root')
    pinned = pinned_releases(root)
    releases = [p for p in (root / 'releases').iterdir() if SHA.fullmatch(p.name) and p.is_dir() and not p.is_symlink()]
    releases.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    keep_names = pinned | {p.name for p in releases[:keep]}
    remove_releases = [str(p) for p in releases if p.name not in keep_names]
    protected = protected_assets(root, pinned)
    groups, unsafe = {}, set()
    if protected is not None and assets.is_dir():
        for directory, children, files in os.walk(assets, followlinks=False):
            children[:] = [n for n in children if not (Path(directory) / n).is_symlink()]
            for name in files:
                path = Path(directory) / name
                relative = path.relative_to(assets).as_posix()
                base = relative.removesuffix('.gz').removesuffix('.br')
                if path.is_symlink() or not stat.S_ISREG(path.lstat().st_mode):
                    unsafe.add(base)
                else:
                    groups.setdefault(base, []).append(path)
    cutoff = (time.time() if now is None else now) - asset_days * 86400
    remove_assets = []
    for base, paths in groups.items():
        if base in unsafe or any(p.relative_to(assets).as_posix() in protected for p in paths):
            continue
        if max(max(p.stat().st_mtime, p.stat().st_atime) for p in paths) < cutoff:
            remove_assets.extend(str(p) for p in paths)
    return dict(schema=1, pinned=sorted(pinned), keepReleases=keep, assetDays=asset_days,
                releases=remove_releases, assets=remove_assets,
                assetBytes=sum(Path(p).stat().st_size for p in remove_assets),
                assetCleanupSkipped=protected is None)


def apply_plan(result, root, assets):
    for value in result['assets']:
        path = Path(value)
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(assets):
            raise ValueError('Asset changed after planning')
        path.unlink()
    for value in result['releases']:
        path = Path(value)
        if path.is_symlink() or path.parent != root / 'releases' or path.resolve() != path or not SHA.fullmatch(path.name):
            raise ValueError('Release changed after planning')
        shutil.rmtree(path)


@contextmanager
def deployment_lock(root):
    import fcntl  # Deletion runs on the Linux VM, under the controller's own lock.
    with (root.parent / '.dndshare-deploy.lock').open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--assets', required=True, type=Path)
    parser.add_argument('--keep', type=int, default=5)
    parser.add_argument('--asset-days', type=int, default=30)
    parser.add_argument('--apply', action='store_true', help='Default is a dry run')
    parser.add_argument('--capture-port', type=int, help='Controller already holds the rollout lock')
    args = parser.parse_args()
    if args.capture_port is not None:
        capture_manifest(args.root, args.capture_port)
        return
    with deployment_lock(args.root):
        result = plan(args.root, args.assets, keep=args.keep, asset_days=args.asset_days)
        if args.apply:
            apply_plan(result, args.root, args.assets)
            result['applied'] = True
            temporary = args.root / 'last-prune.next'
            temporary.write_text(json.dumps(result, indent=2), encoding='utf8')
            temporary.replace(args.root / 'last-prune.json')
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
