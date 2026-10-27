"""CLI wiring; all mutable runtime state lives in ignored build directories."""
import argparse
from contextlib import ExitStack
from pathlib import Path
import subprocess
import sys
import signal

from . import config, doctor, snapshot
from .common import UIError, write_json
from .plan import make_plan
from .policy import check_scope
from .runner import Run, lock, ports, run_plan


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    for name in ("doctor", "prepare", "pin", "status", "focus", "verify", "review"):
        command = commands.add_parser(name)
        command.add_argument("--allow-visible-emulator", action="store_true", help="explicit manual UI session; automated runs default to headless")
        command.add_argument("--emulator", help="explicit emulator serial; never a physical device")
        if name == "status":
            command.add_argument("--run", type=Path, required=True)
        if name in {"focus", "verify", "review"}:
            command.add_argument("--full", action="store_true", help="only after a direct user request")
        if name == "review":
            command.add_argument("--scenario", choices=("form-lifecycle",))
            command.add_argument("--state", action="append", default=[])
        if name == "prepare":
            command.add_argument("--workspace", type=Path, help="new path under build/ui-workspaces")
            command.add_argument("--snapshot", action="store_true", help="freeze copied files while the checkout changes")
        if name in ("focus", "verify", "review"):
            command.add_argument('--pin', action='store_true', help='pin this isolated worktree and check it in one guarded run')
            command.add_argument("--workspace", type=Path, required=True)
            command.add_argument("--snapshot", action="store_true", help="explicitly check a historical frozen source")
            command.add_argument("--timeout", type=int, default=3600, help="timeout per stage in seconds")
        if name == "focus":
            command.add_argument("kind", choices=("webunit", "browser", "native", "tools"))
            command.add_argument("--area", choices=("dev", "visual", "design"))
            command.add_argument("--grep", help="browser test title filter")
            command.add_argument("--file", action="append", default=[], help="frontend-relative existing test file")
            command.add_argument("--project", choices=("ui", "maps", "production"), default="ui")
            command.add_argument("--test-class", help="qualified native instrumentation test class or class#method")
            command.add_argument("--target", choices=("Test", "All", "Android", "DeviceTest"), default="Test")
        if name == "verify":
            command.add_argument("--tag", action="append", choices=("backend",), default=[])
    return root


def capabilities(args):
    if args.command == 'review' and args.scenario == 'form-lifecycle':
        return {'go', 'postgres16', 'android'}, True
    if args.command in {"doctor", "verify", "review"}:
        return None, True
    if args.command in {"prepare", "pin"} or (args.command == "focus" and args.kind == "webunit"):
        return {"node", "dependencies"}, False
    if args.command == "focus" and args.kind == "tools":
        return set(), False
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
    if args.command == "status":
        from .runner import read_status
        import json
        print(json.dumps(read_status(args.run), ensure_ascii=False, indent=2))
        return 0
    try:
        check_scope(args)
    except UIError as error:
        print(str(error), file=sys.stderr)
        return 2
    def interrupted(signum, frame):
        raise KeyboardInterrupt(f"Runner interrupted by signal {signum}")
    previous_term = signal.signal(signal.SIGTERM, interrupted)
    run = Run(source, args.command)
    args.report_dir = run.directory
    run.receipt["fullRequested"] = getattr(args, "full", False)
    try:
        with lock(source / "build/dev-tools/config.lock"):
            tools = dict(config.load(source), allow_visible_emulator=args.allow_visible_emulator)
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
        if args.command == "pin":
            with lock(source / ".ui-run.lock"):
                workspace, manifest = snapshot.pin(source, tools)
            run.receipt.update(workspace=str(workspace), sourceSHA=manifest["sourceSHA"], sourceHash=manifest["sourceHash"])
            print("workspace: " + str(workspace), flush=True)
        elif args.command == "prepare":
            workspace, manifest = snapshot.prepare(source, tools, args.workspace, frozen=args.snapshot)
            run.receipt.update(workspace=str(workspace), sourceSHA=manifest["sourceSHA"], sourceHash=manifest["sourceHash"])
            print("workspace: " + str(workspace), flush=True)
        elif args.command != "doctor":
            with ExitStack() as stack:
                selected = args.workspace.resolve() if args.pin else snapshot.resolve_workspace(source, args.workspace)
                if args.pin and (selected != source or args.snapshot):
                    raise UIError('--pin requires the current isolated worktree, without --snapshot')
                stack.enter_context(lock(selected / ".ui-run.lock"))
                if args.pin:
                    workspace, manifest = snapshot.pin(source, tools)
                else:
                    workspace, manifest = snapshot.validate(source, args.workspace, tools, args.snapshot)
                import time
                run.receipt['sourceVerification'] = {'beforeHash': manifest['sourceHash'], 'beforeChecked': time.time()}
                run.receipt["selection"] = "snapshot" if args.snapshot else "current"
                allocated = ports(3)
                plan = make_plan(args, tools, workspace, serial, allocated[2])
                run_plan(run, plan, tools, workspace, manifest, allocated, args.timeout)
                _, after = snapshot.validate(source, workspace, tools, frozen=True)
                if any(after[key] != manifest[key] for key in ('sourceHash', 'sourceSHA')):
                    raise UIError('Candidate identity changed during the run')
                run.receipt['sourceVerification'].update(afterHash=after['sourceHash'], afterChecked=time.time())
                if args.command == 'review' and all(row['status'] == 'passed' for row in run.receipt['stages']):
                    output = run.directory / 'review'
                    write_json(output / 'source-verification.json', {'sourceStable': True,
                        'sourceSHA': manifest['sourceSHA'], 'sourceHash': manifest['sourceHash']})
                    if not args.scenario:
                        subprocess.run([sys.executable, str(workspace / 'scripts/visual/report.py'), '--output', str(output)], check=True)
        return run.finish()
    except (UIError, OSError, ValueError, KeyError, subprocess.SubprocessError, KeyboardInterrupt) as error:
        print(str(error) or "Interrupted", file=sys.stderr)
        return run.finish(error or "Interrupted")
    finally:
        signal.signal(signal.SIGTERM, previous_term)
