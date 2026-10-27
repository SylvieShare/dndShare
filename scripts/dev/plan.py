"""Fixed, reviewable UI matrix and explicit focus routes."""
from dataclasses import dataclass
from pathlib import Path
import sys

from .common import UIError
from .windows import native_command


@dataclass
class Stage:
    name: str
    command: list
    cwd: Path
    native: bool = False
    device: bool = False


def npm(config, *args):
    cli = Path(config["node"]).parent.parent / "lib/node_modules/npm/bin/npm-cli.js"
    return [config["node"], str(cli), *args]


def selected_files(workspace, kind, files):
    result = []
    for value in files:
        relative = Path(value)
        prefix = "src" if kind == "webunit" else "tests"
        file = (workspace / "frontend" / relative).resolve()
        if (relative.is_absolute() or ".." in relative.parts or not relative.parts
                or relative.parts[0] != prefix or not file.is_file()
                or not file.is_relative_to(workspace / "frontend")):
            raise UIError(f"Select an existing frontend/{prefix} test file: {value}")
        if kind == "webunit" and not any(part in relative.name for part in (".test.", ".spec.")):
            raise UIError(f"Not a unit test file: {value}")
        result.append(relative.as_posix())
    return result


def make_plan(args, config, workspace, serial, api_port):
    frontend = workspace / "frontend"

    def node(name, *command):
        return Stage(name, npm(config, *command), frontend)

    def python(name, script):
        if not (workspace / script).is_file():
            raise UIError(f"Required check has not been implemented: {script}")
        return Stage(name, [sys.executable, script, "--check"], workspace)

    def native(name, target):
        return Stage(name, native_command(config, workspace, target, serial, getattr(args, "test_class", None)), workspace, True, target == "DeviceTest")

    if args.command == "focus":
        if args.kind == "tools":
            if not args.area:
                raise UIError("Choose --area dev, visual or design for tooling checks")
            return [Stage("tools-" + args.area, [sys.executable, "-m", "unittest", "discover", "-s", "scripts/" + args.area, "-p", "test_*.py"], workspace)]
        files = selected_files(workspace, args.kind, args.file)
        if args.kind == "webunit":
            if not files:
                return [node("webunit", "test", "--", "--run", "--no-cache")]
            return [node("bindings", "run", "check:bindings"),
                    Stage("webunit", [config["node"], "node_modules/vitest/vitest.mjs", "run", *files,
                                      "--no-cache"], frontend)]
        if args.kind == "browser":
            return [node("browser", "run", "test:browser", "--", "--project=" + args.project, *files, *(["--grep", args.grep] if args.grep else []))]
        if files:
            raise UIError("--file applies to webunit/browser only")
        return [native("native" + args.target, args.target)]
    if args.command == "review":
        script = workspace / "scripts/visual/compare.py"
        if not script.is_file():
            raise UIError("Visual runner is not present in this snapshot: scripts/visual/compare.py")
        if any(value in {"--output", "--serial"} or value.startswith(("--output=", "--serial="))
               for value in args.visual_args):
            raise UIError("review owns --output/--serial; choose the emulator with --emulator")
        scope = (["--full"] if args.full else []) + (["--scenario", args.scenario] if args.scenario else [])
        for state in args.state:
            scope += ["--state", state]
        return [Stage("review", [sys.executable, str(script), "--output", str(args.report_dir / "review"),
                                  "--serial", serial, *scope, *args.visual_args], workspace, device=True)]
    stages = [node("webunit", "test", "--", "--run", "--no-cache"),
              node("webbuild", "run", "build"),
              node("browser", "run", "test:browser", "--"),
              native("nativeAll", "All"), native("nativeDeviceTest", "DeviceTest"),
              python("palette-icons", "scripts/native/sync_web_design.py"),
              python("tokens", "scripts/design/tokens.py")]
    if (workspace / "scripts/design/fonts.py").is_file():
        stages.append(python("fonts", "scripts/design/fonts.py"))
    stages.append(Stage("wiki", [sys.executable, "scripts/check-wiki.py", "--strict"], workspace))
    if "backend" in args.tag:
        for name, command in (("go-test", ["test", "-count=1", "./..."]),
                              ("go-vet", ["vet", "./..."]), ("go-build", ["build", "./..."])):
            stages.append(Stage(name, [config["go"], *command], workspace))
    return stages
