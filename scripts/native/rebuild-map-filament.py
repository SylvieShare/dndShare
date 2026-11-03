#!/usr/bin/env python3
"""Rebuild the pinned Filament AAR with correct orthographic light planes (Windows/WSL)."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'native/vendor/filament'
VERSION = '1.77.3'
COMMIT = 'd852e34cd5629a6f3851d613dcd17aa0ffd025a2'
NDK = '29.0.14206865'
CMAKE = '3.31.6'
ABIS = ('arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64')
NATIVE_HASH = '81840d3bcf8cac055b41757455b60fc6602df5e6a298d42b84206a73af397a88'
AAR_HASH = '587a73db65e7c1289af799b1a7e0d7debdbeb9bf8d4253adb203199811096490'
CPP_HASH = 'e319b51cb218095ebccb0a501cc83f18f3d9d18b154caf40645dd2222d4aabfc'
OUTPUT = VENDOR / f'filament-android-{VERSION}-ortho1.aar'
INPUTS = (Path(__file__).resolve(), VENDOR / 'CMakeLists.txt',
          VENDOR / 'orthographic-froxels.patch')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args, cwd=None):
    subprocess.run([str(a) for a in args], cwd=cwd, check=True)


def toolpath(path):
    value = path.resolve().as_posix()
    if value.startswith('/mnt/') and len(value) > 6 and value[6] == '/':
        return value[5].upper() + ':' + value[6:]
    return value


def download(url, path, expected):
    if not path.exists():
        temporary = path.with_suffix('.download')
        urllib.request.urlretrieve(url, temporary)
        assert digest(temporary) == expected, f'Unexpected download: {url}'
        temporary.replace(path)
    assert digest(path) == expected, f'Unexpected cached archive: {path}'


def check():
    data = json.loads((VENDOR / 'manifest.json').read_text())
    assert data['version'] == VERSION and data['commit'] == COMMIT
    for name, expected in data['sources'].items():
        assert digest(ROOT / name) == expected, f'Rebuild Filament after changing {name}'
    assert set(data['sources']) == {p.relative_to(ROOT).as_posix() for p in INPUTS}
    assert digest(OUTPUT) == data['aarHash'], 'Invalid patched Filament AAR'
    with zipfile.ZipFile(OUTPUT) as archive:
        for abi in ABIS:
            value = archive.read(f'jni/{abi}/libfilament-jni.so')
            assert hashlib.sha256(value).hexdigest() == data['libraries'][abi]
    print('Patched Filament package matches its sources and all four ABIs')


def rebuild(cache, sdk):
    cache.mkdir(parents=True, exist_ok=True)
    source = cache / 'sparse'
    if not source.exists():
        run('git', '-c', 'core.autocrlf=false', 'clone', '--depth', '1',
            '--filter=blob:none', '--sparse', '--branch', 'v' + VERSION,
            'https://github.com/google/filament.git', source)
    head = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True)
    assert head.strip() == COMMIT, 'Unexpected Filament source revision'
    run('git', '-C', source, 'diff', '--exit-code', 'HEAD')
    run('git', '-C', source, 'sparse-checkout', 'set', 'android/filament-android',
        'android/common', 'filament/src', 'filament/backend/include',
        'libs/utils/include', 'libs/math/include', 'libs/filabridge/include',
        'libs/filaflat/include', 'libs/bluevk/include', 'third_party/robin-map',
        'third_party/perfetto')
    original = source / 'filament/src/Froxelizer.cpp'
    assert digest(original) == CPP_HASH
    # Apply only the reviewed patch, in a private copy; never mutate the upstream checkout.
    patched = cache / 'patched'
    (patched / 'filament/src').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, patched / 'filament/src/Froxelizer.cpp')
    run('git', 'apply', VENDOR / 'orthographic-froxels.patch', cwd=patched)

    url = f'https://github.com/google/filament/releases/download/v{VERSION}/'
    native = cache / 'android-native.tgz'
    download(url + f'filament-v{VERSION}-android-native.tgz', native, NATIVE_HASH)
    distribution = cache / 'sdk/filament'
    if not distribution.exists():
        with tarfile.open(native) as archive:
            archive.extractall(cache / 'sdk', filter='data')
    aar = cache / 'original.aar'
    download(f'https://repo.maven.apache.org/maven2/com/google/android/filament/'
             f'filament-android/{VERSION}/filament-android-{VERSION}.aar', aar, AAR_HASH)
    suffix = '.exe' if os.name == 'nt' or str(sdk).startswith('/mnt/') else ''
    cmake = sdk / f'cmake/{CMAKE}/bin/cmake{suffix}'
    llvm = sdk / f'ndk/{NDK}/toolchains/llvm/prebuilt'
    platform = 'windows-x86_64' if suffix else 'linux-x86_64'
    strip = llvm / platform / f'bin/llvm-strip{suffix}'
    binaries = {}
    for abi in ABIS:
        build = cache / 'ortho-build' / abi
        run(cmake, '-G', 'Ninja', '-S', toolpath(VENDOR), '-B', toolpath(build),
            '-DCMAKE_TOOLCHAIN_FILE=' + toolpath(sdk / f'ndk/{NDK}/build/cmake/android.toolchain.cmake'),
            '-DANDROID_ABI=' + abi, '-DANDROID_PLATFORM=android-26',
            '-DANDROID_STL=c++_static', '-DCMAKE_BUILD_TYPE=Release',
            '-DFILAMENT_DIST_DIR=' + toolpath(distribution),
            '-DFILAMENT_SOURCE_DIR=' + toolpath(source),
            '-DFILAMENT_PATCHED_FROXELIZER=' + toolpath(patched / 'filament/src/Froxelizer.cpp'),
            '-DCMAKE_MAKE_PROGRAM=' + toolpath(sdk / f'cmake/{CMAKE}/bin/ninja{suffix}'))
        run(cmake, '--build', toolpath(build), '-j', '8')
        library = build / 'upstream/libfilament-jni.so'
        run(strip, '--strip-unneeded', toolpath(library))
        binaries[abi] = library.read_bytes()
    temporary = OUTPUT.with_suffix('.tmp')
    with zipfile.ZipFile(aar) as original, zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as out:
        for name in sorted(original.namelist()):
            value = original.read(name)
            if name.startswith('jni/') and name.endswith('/libfilament-jni.so'):
                value = binaries[name.split('/')[1]]
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            out.writestr(info, value)
    temporary.replace(OUTPUT)
    data = {'version': VERSION, 'commit': COMMIT, 'ndk': NDK, 'cmake': CMAKE,
            'upstreamNativeHash': NATIVE_HASH, 'upstreamAarHash': AAR_HASH,
            'sources': {p.relative_to(ROOT).as_posix(): digest(p) for p in INPUTS},
            'aarHash': digest(OUTPUT),
            'libraries': {a: hashlib.sha256(b).hexdigest() for a, b in binaries.items()}}
    (VENDOR / 'manifest.json').write_text(json.dumps(data, indent=2) + '\n')
    shutil.copyfile(distribution / 'LICENSE', VENDOR / 'LICENSE')
    check()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / 'build/filament-ortho')
    parser.add_argument('--sdk', type=Path, default=os.environ.get('ANDROID_HOME',
                        '/mnt/c/Users/wrz2/AppData/Local/Android/Sdk'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        check()
    else:
        rebuild(args.cache.resolve(), args.sdk.resolve())
