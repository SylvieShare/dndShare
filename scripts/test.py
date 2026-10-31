#!/usr/bin/env python3
"""Run project tests with explicit profiles and disposable local PostgreSQL."""
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def run(command, cwd=ROOT, env=None):
    print("\n> " + " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


@contextmanager
def postgres(env):
    if env.get("DNDSHARE_TEST_DSN"):
        yield dict(env, DNDSHARE_TEST_REQUIRED="1")
        return
    for tool in ["initdb", "pg_ctl", "createdb"]:
        if not shutil.which(tool):
            raise RuntimeError("Install local PostgreSQL or set DNDSHARE_TEST_DSN to a 127.0.0.1/dndshare_test_* parent database")
    with tempfile.TemporaryDirectory(prefix="dndshare-test-") as directory:
        data = Path(directory) / "data"
        port = free_port()
        run(["initdb", "-D", data, "-A", "trust", "-U", "dndshare_test", "--no-locale", "--encoding=UTF8"], env=env)
        started = False
        try:
            run(["pg_ctl", "-D", data, "-l", Path(directory) / "postgres.log", "-o", f"-p {port} -h 127.0.0.1 -k {directory}", "-w", "start"], env=env)
            started = True
            run(["createdb", "-h", "127.0.0.1", "-p", port, "-U", "dndshare_test", "dndshare_test_runner"], env=env)
            yield dict(env, DNDSHARE_TEST_REQUIRED="1", DNDSHARE_TEST_DSN=f"postgres://dndshare_test@127.0.0.1:{port}/dndshare_test_runner?sslmode=disable")
        finally:
            if started:
                run(["pg_ctl", "-D", data, "-m", "fast", "-w", "stop"], env=env)


def backend(env, database):
    if database:
        with postgres(env) as pg_env:
            run(["go", "test", "-count=1", "./..."], env=pg_env)
    else:
        run(["go", "test", "./..."], env=env)
    run(["go", "vet", "./..."], env=env)
    run(["go", "build", "./..."], env=env)


def scripts(env):
    node_tests = sorted((ROOT / "scripts").rglob("*.test.mjs"))
    run(["node", "--test", *node_tests], env=env)
    for directory in ["deploy", "scripts/docs", "scripts/design", "scripts/dev", "scripts/visual", "scripts/creatures", "scripts/rules-editions", "scripts/spell-automation", "scripts/spell-automation/review"]:
        run([sys.executable, "-m", "unittest", "discover", "-s", directory, "-p", "test_*.py"], env=env)


def frontend(env, build):
    run(["npm", "test"], cwd=ROOT / "frontend", env=env)
    if build:
        run(["npm", "run", "build"], cwd=ROOT / "frontend", env=env)


def browser(env, project=None):
    env = dict(env, DNDSHARE_BROWSER_DEV_PORT=str(free_port()), DNDSHARE_BROWSER_BUILD_PORT=str(free_port()))
    report_name = project or "browser"
    env.setdefault("DNDSHARE_BROWSER_REPORT", str(ROOT / "frontend/target/test-reports" / (report_name + ".json")))
    env.setdefault("DNDSHARE_BROWSER_OUTPUT", str(ROOT / "frontend/target/test-results" / report_name))
    command = ["npm", "run", "test:browser", "--"]
    if project:
        env["DNDSHARE_TEST_MODELS"] = "1"
        command = ["npx", "playwright", "test", "-c", "playwright.suite.config.js", "--project", project]
    failure = None
    try:
        run(command, cwd=ROOT / "frontend", env=env)
    except subprocess.CalledProcessError as error:
        failure = error
    if not project:
        with postgres(env) as pg_env:
            run(["go", "test", "-count=1", "-run", "^TestBrowserAuthPostgres$", "./internal/web"], env=dict(pg_env, DNDSHARE_BROWSER_SMOKE="1"))
    if failure:
        raise failure


def models(env):
    blender = env.get("BLENDER_BIN") or shutil.which("blender")
    app = Path("/Applications/Blender.app/Contents")
    if not blender and (app / "MacOS/Blender").is_file():
        blender = str(app / "MacOS/Blender")
    if not blender:
        raise RuntimeError("Model tests require Blender; set BLENDER_BIN or put blender on PATH")
    python = env.get("MODEL_PYTHON")
    bundled = sorted((app / "Resources").glob("*/python/bin/python3.*"))
    python = python or (str(bundled[-1]) if bundled else sys.executable)
    miniature_runtime = ROOT / "models/creatures/.generation-runtime/bin/python"
    miniature_python = env.get("MODEL_PYTHON") or (str(miniature_runtime) if miniature_runtime.is_file() else python)
    run([miniature_python, "-m", "unittest", "discover", "-s", "scripts/creatures", "-p", "test_lod_silhouette.py"],
        env=dict(env, DNDSHARE_TEST_MODELS="1"))
    run([miniature_python, "-m", "unittest", "discover", "-s", "scripts/creatures", "-p", "test_native_geometry.py"],
        env=dict(env, DNDSHARE_TEST_MODELS="1"))
    failures = []
    geometry_tests = sorted((ROOT / "scripts/maps").glob("test*.py"))
    geometry_tests.append(ROOT / "scripts/creatures/test_source_pose_cleanup.py")
    for file in geometry_tests:
        if re.search(r"(^[ \t]*import (bpy|bmesh)|^[ \t]*from mathutils)", file.read_text(), re.M):
            expression = f"import sys,runpy; sys.path.insert(0,{str(file.parent)!r}); sys.argv=[{str(file)!r}]; runpy.run_path({str(file)!r},run_name='__main__')"
            command = [blender, "--background", "--factory-startup", "-t", "2", "--python-exit-code", "1", "--python-expr", expression]
        else:
            command = [python, file]
        try:
            run(command, env=env)
        except subprocess.CalledProcessError:
            failures.append(file.name)
    if failures:
        raise RuntimeError("Failed model tests: " + ", ".join(failures))
    browser(env, "models")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", nargs="?", default="fast", choices=["fast", "db", "browser", "models", "all"])
    parser.add_argument('--full', action='store_true', help='broad profile, only after a direct user request')
    args = parser.parse_args()
    if args.profile in {'fast', 'browser', 'all'} and not args.full:
        parser.error('Broad profiles require --full after a direct user request. Use scripts/ui.py focus with explicit files for normal work.')
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    env.setdefault("GOCACHE", str(Path(tempfile.gettempdir()) / "dndshare-go-cache"))
    stages = {
        "backend": lambda: backend(env, args.profile in ["db", "all"]),
        "frontend": lambda: frontend(env, args.profile == "fast"),
        "scripts": lambda: scripts(env),
        "wiki": lambda: run([sys.executable, "scripts/check-wiki.py", "--strict"], env=env),
        "browser": lambda: browser(env),
        "models": lambda: models(env),
    }
    selected = {"fast": ["backend", "frontend", "scripts", "wiki"], "db": ["backend"], "browser": ["browser"], "models": ["models"], "all": list(stages)}[args.profile]
    results = []
    for name in selected:
        start = time.monotonic()
        try:
            stages[name]()
            results.append({"stage": name, "status": "passed", "seconds": round(time.monotonic() - start, 2)})
        except (subprocess.CalledProcessError, RuntimeError, OSError) as error:
            print(f"{name}: {error}", file=sys.stderr)
            results.append({"stage": name, "status": "failed", "seconds": round(time.monotonic() - start, 2)})
    print("\nTest profile " + args.profile + ":\n" + json.dumps(results, indent=2), flush=True)
    return int(any(result["status"] != "passed" for result in results))


if __name__ == "__main__":
    raise SystemExit(main())
