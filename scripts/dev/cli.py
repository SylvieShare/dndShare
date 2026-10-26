"""CLI wiring; all mutable runtime state lives in ignored build directories."""
import argparse
from contextlib import ExitStack
from pathlib import Path
import subprocess
import sys

from . import config, doctor, snapshot
from .common import UIError
from .plan import make_plan
from .runner import Run, lock, ports, run_plan


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    for name in ("doctor", "prepare", "focus", "verify", "review"):
        command = commands.add_parser(name)
        command.add_argument("--emulator", help="explicit emulator serial; never a physical device")
        if name == "prepare":
            command.add_argument("--workspace", type=Path, help="new path under build/ui-workspaces")
            command.add_argument("--snapshot", action="store_true", help="freeze copied files while the checkout changes")
        if name in ("focus", "verify", "review"):
            command.add_argument("--workspace", type=Path, required=True)
            command.add_argument("--snapshot", action="store_true", help="explicitly check a historical frozen source")
            command.add_argument("--timeout", type=int, default=3600, help="timeout per stage in seconds")
        if name == "focus":
            command.add_argument("kind", choices=("webunit", "browser", "native"))
            command.add_argument("--file", action="append", default=[], help="frontend-relative existing test file")
            command.add_argument("--project", choices=("ui", "maps", "production"), default="ui")
            command.add_argument("--target", choices=("Test", "All", "Android", "DeviceTest"), default="Test")
        if name == "verify":
            command.add_argument("--tag", action="append", choices=("backend",), default=[])
    return root


def capabilities(args):
    if args.command in {"doctor", "verify", "review"}:
        return None, True
    if args.command == "prepare" or args.kind == "webunit":
        return {"node", "dependencies"}, False
    if args.kind == "browser":
        return {"node", "dependencies", "playwright-chromium"}, False
    return {"android"}, args.target == "DeviceTest"


def main(argv=None, source=None):
    arguments = list(sys.argv[1:] if argv is None else argv)
    extra = []
    if "--" in arguments:
        separator = arguments.index("--")
        arguments, extra = arguments[:separator], arguments[separator + 1:]
    cli = parser()
    args = cli.parse_args(arguments)
    if extra and args.command != "review":
        cli.error("arguments after -- are supported only by review")
    args.visual_args = extra
    if getattr(args, "timeout", 1) <= 0:
        cli.error("--timeout must be positive")
    if args.command == "focus":
        if args.kind != "native" and args.target != "Test":
            cli.error("--target applies only to focus native")
        if args.kind != "browser" and args.project != "ui":
            cli.error("--project applies only to focus browser")
        if args.kind == "native" and args.file:
            cli.error("--file applies only to focus webunit/browser")
    source = Path(source or Path(__file__).resolve().parents[2]).resolve()
    run = Run(source, args.command)
    args.report_dir = run.directory
    try:
        with lock(source / "build/dev-tools/config.lock"):
            tools = config.load(source)
        required, require_device = capabilities(args)
        diagnostic_source = source
        if args.command in {"focus", "verify", "review"} and (args.workspace / snapshot.MANIFEST).is_file():
            diagnostic_source = snapshot.resolve_workspace(source, args.workspace)
        diagnosis = doctor.inspect(diagnostic_source, tools, run.directory, args.emulator,
                                   capabilities=required, require_device=require_device)
        run.receipt["doctor"] = diagnosis
        run.receipt["toolConfig"] = str(source / "build/dev-tools/local-tools.json")
        serial = next((c["detail"].get("serial") for c in diagnosis["checks"] if c["name"] == "android"), None)
        run.receipt["emulator"] = serial
        if args.command == "prepare":
            workspace, manifest = snapshot.prepare(source, tools, args.workspace, frozen=args.snapshot)
            run.receipt.update(workspace=str(workspace), sourceSHA=manifest["sourceSHA"], sourceHash=manifest["sourceHash"])
            print("workspace: " + str(workspace), flush=True)
        elif args.command != "doctor":
            with ExitStack() as stack:
                selected = snapshot.resolve_workspace(source, args.workspace)
                stack.enter_context(lock(selected / ".ui-run.lock"))
                workspace, manifest = snapshot.validate(source, args.workspace, tools, args.snapshot)
                run.receipt["selection"] = "snapshot" if args.snapshot else "current"
                allocated = ports(3)
                plan = make_plan(args, tools, workspace, serial, allocated[2])
                if any(stage.native or stage.name == "review" for stage in plan):
                    stack.enter_context(lock(source / "build/dev-tools/emulator.lock"))
                run_plan(run, plan, tools, workspace, manifest, allocated, args.timeout)
                snapshot.validate(source, workspace, tools, frozen=True)
        return run.finish()
    except (UIError, OSError, ValueError, KeyError, subprocess.SubprocessError, KeyboardInterrupt) as error:
        print(str(error) or "Interrupted", file=sys.stderr)
        return run.finish(error or "Interrupted")
