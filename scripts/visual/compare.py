#!/usr/bin/env python3
"""Capture WEB/ANDROID review evidence using one isolated Go API/PostgreSQL."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from source import source_identity
from exceptions import read_exceptions

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "build/ui-review")
    parser.add_argument("--serial", default=os.environ.get("DNDSHARE_ANDROID_SERIAL", "emulator-5554"))
    parser.add_argument("--exceptions", type=Path, default=ROOT / "design/visual-exceptions.json")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    # A second run must never accidentally accept the previous run's evidence.
    if any((output / name).exists() for name in ("manifest.json", "index.html", "web", "android")):
        parser.error("Output already contains review evidence; choose a fresh --output directory")
    exceptions = args.exceptions.resolve()
    try:
        value = read_exceptions(exceptions)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    (output / "exceptions.json").write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    identity = source_identity(ROOT)
    (output / "source.json").write_text(json.dumps(identity, indent=2), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("project_test_runner", ROOT / "scripts/test.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", DNDSHARE_UI_REVIEW="1",
               DNDSHARE_UI_REVIEW_OUTPUT=str(output), DNDSHARE_ANDROID_SERIAL=args.serial)
    env.setdefault("GOCACHE", str(Path(tempfile.gettempdir()) / "dndshare-go-cache"))
    try:
        with runner.postgres(env) as pg_env:
            subprocess.run(["go", "test", "-count=1", "-timeout=25m", "-v", "-run",
                            "^TestUIReviewPostgres$", "./internal/web"], cwd=ROOT, env=pg_env, check=True)
        if source_identity(ROOT) != identity:
            raise RuntimeError("Capture sources changed during the run; repeat from a stable prepared checkout")
        # Only complete, source-stable captures receive a success report.
        from report import write_report
        write_report(output)
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        (output / "failure.txt").write_text(str(error), encoding="utf-8")
        print(f"UI review failed: {error}; diagnostics: {output}", file=sys.stderr)
        return 1
    print(f"Captured 18 images. Human visual review required: {output / 'index.html'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
