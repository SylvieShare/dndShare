"""Reuse compiled smoke APKs; never reuse a test outcome or production user data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import fcntl
from contextlib import contextmanager

from adb import native_path, powershell_path, run

DEVICE_PORT = json.loads(Path(__file__).with_name('endpoint.json').read_text())['devicePort']
API_BASE = f'http://127.0.0.1:{DEVICE_PORT}'


def input_hash(root):
    digest = hashlib.sha256()
    native = root / 'native'
    excluded = {'build', '.gradle', '.kotlin', '.idea', 'test', 'androidTest', 'testSupport', 'benchmark', 'macrobenchmark'}
    inputs = []
    for directory, subdirs, files in os.walk(native):
        subdirs[:] = [name for name in subdirs if name not in excluded]
        inputs.extend(Path(directory) / name for name in files if not name.endswith('.md') and name != 'local.properties')
    for file in sorted(inputs):
        relative = file.relative_to(native)
        data = file.read_bytes()
        if b'\0' not in data:
            try: data.decode('utf-8'); data = data.replace(b'\r\n', b'\n')
            except UnicodeDecodeError: pass
        digest.update(str(relative).encode() + b'\0' + data)
    for name in ['build.ps1', 'test-results.ps1']:
        digest.update((root / 'scripts/native' / name).read_bytes().replace(b'\r\n', b'\n'))
    config_file = origin(root) / 'build/dev-tools/local-tools.json'
    if config_file.exists():
        config = json.loads(config_file.read_text())
        for key in ('java_home', 'android_home'):
            value = config.get(key, '')
            digest.update(value.encode())
            if value:
                location = Path(run(['wslpath', '-u', value]).decode().strip())
                candidates = [location / 'release'] if key == 'java_home' else sorted((location / 'platforms').glob('*/source.properties'))
                for candidate in candidates:
                    if candidate.is_file(): digest.update(candidate.read_bytes())
    digest.update(API_BASE.encode())
    return digest.hexdigest()


def origin(root):
    manifest = root / '.ui-workspace.json'
    return Path(json.loads(manifest.read_text())['source']) if manifest.exists() else root


@contextmanager
def build_lock(root):
    common = Path(run(['git', '-C', origin(root), 'rev-parse', '--path-format=absolute', '--git-common-dir']).decode().strip())
    location = common / 'ui-locks/native-build.lock'
    location.parent.mkdir(parents=True, exist_ok=True)
    with location.open('a') as file:
        try: fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error: raise RuntimeError('Another native build is running; retry after it finishes') from error
        try: yield
        finally: fcntl.flock(file, fcntl.LOCK_UN)


def obtain(root, output):
    source_hash = input_hash(root)
    cache = origin(root) / 'build/native-apk-cache' / source_hash
    cached = cache / 'smoke.apk'
    metadata = cache / 'artifact.json'
    with build_lock(root):
        if cached.exists() and metadata.exists():
            data = json.loads(metadata.read_text())
            if data.get('inputHash') == source_hash and data.get('apiBase') == API_BASE and data.get('apkHash') == hashlib.sha256(cached.read_bytes()).hexdigest():
                return cached, dict(data, reused=True)
        with (output / 'apk-build.log').open('wb') as log:
            subprocess.run([powershell_path(), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
                            native_path(root / 'scripts/native/build.ps1'), '-Target', 'Android', '-ApiBaseUrl', API_BASE],
                           stdout=log, stderr=subprocess.STDOUT, check=True, timeout=900)
        if input_hash(root) != source_hash:
            raise RuntimeError('Native build inputs changed while compiling')
        artifact = root / 'native/androidApp/build/outputs/apk/debug/androidApp-debug.apk'
        cache.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact, cached)
        data = dict(inputHash=source_hash, apiBase=API_BASE, apkHash=hashlib.sha256(cached.read_bytes()).hexdigest())
        metadata.write_text(json.dumps(data, indent=2))
        return cached, dict(data, reused=False)
