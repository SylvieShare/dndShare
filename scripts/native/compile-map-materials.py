#!/usr/bin/env python3
"""Compile pinned Filament materials; Gradle consumes the checked-in packages."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = "1.77.3"
PACKAGE_VERSION = "77"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def default_compiler():
    common = Path(subprocess.check_output(
        ["git", "rev-parse", "--git-common-dir"], cwd=ROOT, text=True,
    ).strip())
    if not common.is_absolute():
        common = ROOT / common
    return common.resolve().parent / f"build/format-tools/filament-v{VERSION}/bin/matc"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matc", type=Path, default=default_compiler())
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    sources = ROOT / "native/androidApp/materials"
    output = ROOT / "native/androidApp/src/main/assets/maps/materials"
    manifest = output / "manifest.json"
    inputs = {path.name: digest(path) for path in sorted(path for path in sources.iterdir() if path.suffix in (".mat", ".glsl"))}
    if not inputs:
        parser.error("No map material sources found")
    if args.check:
        data = json.loads(manifest.read_text())
        if data["version"] != VERSION or data["sources"] != inputs:
            parser.error("Recompile map materials")
        expected_packages = {Path(name).stem + ".filamat" for name in inputs if name.endswith(".mat")}
        if set(data["outputs"]) != expected_packages:
            parser.error("Missing or unexpected material packages")
        for name, expected in data["outputs"].items():
            if digest(output / name) != expected:
                parser.error(f"Map material package differs: {name}")
        print("Map materials match their sources")
        return
    compiler = args.matc.resolve()
    version = subprocess.check_output([compiler, "--version"], text=True).strip()
    if version != PACKAGE_VERSION:
        parser.error(f"Expected material package version {PACKAGE_VERSION}, got {version}")
    output.mkdir(parents=True, exist_ok=True)
    for name in inputs:
        if not name.endswith(".mat"):
            continue
        destination = output / (Path(name).stem + ".filamat")
        destination.unlink(missing_ok=True)
        subprocess.run([
            compiler, "-p", "mobile", "-a", "opengl", "-o",
            destination, sources / name,
        ], check=True)
        if not destination.is_file():
            raise RuntimeError(f"Compiler did not create {destination.name}")
    packages = {path.name: digest(path) for path in sorted(output.glob("*.filamat"))}
    manifest.write_text(json.dumps({
        "version": VERSION, "sources": inputs, "outputs": packages,
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
