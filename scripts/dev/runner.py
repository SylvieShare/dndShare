"""Unique run evidence and guarded execution of prepared sources."""
from contextlib import contextmanager, ExitStack
import fcntl
from pathlib import Path
import shutil
import os
import hashlib
import socket
import subprocess
import time

from .common import UIError, execute, identifier, write_json, read_json, capture
from .dependencies import environment


@contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise UIError("Another UI run owns " + str(path)) from error
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def ports(count):
    listeners = []
    try:
        for _ in range(count):
            listener = socket.socket()
            listener.bind(("127.0.0.1", 0))
            listeners.append(listener)
        return [listener.getsockname()[1] for listener in listeners]
    finally:
        for listener in listeners:
            listener.close()


class Run:
    def __init__(self, source, command):
        self.source = source
        self.directory = source / "build/ui-runs" / identifier()
        self.directory.mkdir(parents=True)
        self.receipt = {"schema": 1, "command": command, "status": "running", "stages": [],
                        "run": str(self.directory), "started": time.time(), "runnerPid": os.getpid(),
                        "runnerStart": process_identity(os.getpid()), "heartbeat": time.time()}
        self.save()

    def save(self):
        self.receipt["heartbeat"] = time.time()
        write_json(self.directory / "receipt.json", self.receipt)

    def finish(self, error=None):
        failed = any(stage["status"] != "passed" for stage in self.receipt["stages"])
        self.receipt.update(status="failed" if error or failed else "passed", finished=time.time())
        if error:
            self.receipt["error"] = str(error)
            (self.directory / "error.log").write_text(str(error) + "\n", encoding="utf-8")
        self.save()
        print("receipt: " + str(self.directory / "receipt.json"), flush=True)
        return int(self.receipt["status"] != "passed")


def run_plan(run, plan, config, workspace, manifest, selected_ports, timeout):
    env = environment(config)
    hot = Path(manifest["hotCache"]) / run.directory.name
    hot.mkdir(parents=True)
    dev_port, build_port, api_port = selected_ports
    env.update(TMPDIR=str(hot),
               DNDSHARE_VITE_CACHE=str(hot / "vite"),
               DNDSHARE_BROWSER_DEV_PORT=str(dev_port), DNDSHARE_BROWSER_BUILD_PORT=str(build_port),
               DNDSHARE_BROWSER_REPORT=str(run.directory / "browser.json"),
               DNDSHARE_BROWSER_OUTPUT=str(run.directory / "browser-output"),
               DNDSHARE_UI_REPORT_DIR=str(run.directory), DNDSHARE_UI_WORKSPACE=str(workspace),
               DNDSHARE_UI_SOURCE_SHA=manifest["sourceSHA"], DNDSHARE_UI_SOURCE_HASH=manifest["sourceHash"])
    if run.receipt.get("emulator"):
        env["DNDSHARE_ANDROID_SERIAL"] = run.receipt["emulator"]
    run.receipt.update(sourceSHA=manifest["sourceSHA"], sourceHash=manifest["sourceHash"],
                       workspace=str(workspace), ports=selected_ports, cache=str(hot))
    run.save()
    for stage in plan:
        print("run " + stage.name, flush=True)
        log = run.directory / (stage.name + ".log")
        record = {"name": stage.name, "status": "running", "command": list(map(str, stage.command)),
                  "cwd": str(stage.cwd), "log": str(log), "started": time.time(), "fresh": True}
        run.receipt["stages"].append(record)
        run.save()
        try:
            def progress(pid):
                record["childPid"] = pid
                run.save()
            with ExitStack() as guards:
                if stage.device:
                    guards.enter_context(lock(shared_locks(workspace) / "emulator.lock"))
                if stage.native:
                    guards.enter_context(lock(shared_locks(workspace) / "native-build.lock"))
                code = execute(stage.command, stage.cwd, env, log, timeout, on_progress=progress)
            record.update(status="passed" if code == 0 else "failed", exitCode=code)
        except (OSError, subprocess.TimeoutExpired) as error:
            record.update(status="failed", error=str(error))
        except KeyboardInterrupt:
            record.update(status="interrupted")
            raise
        finally:
            if stage.native:
                for module in ("androidApp", "designSystem"):
                    base = workspace / "native" / module / "build"
                    for relative in ("reports", "test-results", "outputs/androidTest-results"):
                        report = base / relative
                        if report.is_dir():
                            shutil.copytree(report, run.directory / stage.name / module / relative, dirs_exist_ok=True)
            record["finished"] = time.time()
            if record['status'] == 'failed':
                record['signature'] = hashlib.sha256((stage.name + '\n' + (log.read_text(errors='replace')[-4000:] if log.exists() else record.get("error", "failed"))).encode()).hexdigest()
                run.save()
                from .triage import repeated_failure
                if repeated_failure(run.source / 'build/ui-runs', record['signature']):
                    record['nextAction'] = 'Collect a targeted repro and trace before another broad run.'
            run.save()
        print(f"{stage.name}: {record['status']} ({log})", flush=True)
        if record['status'] != 'passed' and not run.receipt.get('fullRequested', False):
            break


def process_identity(pid):
    try:
        return Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    except OSError:
        return None


def shared_locks(workspace):
    """Coordinate all worktrees of this repository, not just one checkout."""
    manifest = read_json(workspace / '.ui-workspace.json')
    source = Path(manifest['source'])
    common = Path(capture(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=source))
    return common / 'ui-locks'


def read_status(directory):
    receipt = read_json(Path(directory) / 'receipt.json')
    if receipt['status'] == 'running' and process_identity(receipt.get('runnerPid', -1)) != receipt.get('runnerStart', 'unknown'):
        receipt = dict(receipt, status='interrupted', staleReceipt=True,
                       error='Runner is no longer alive; recorded stage passes remain historical evidence only.')
    browser = Path(directory) / 'browser.json'
    if browser.exists():
        from .triage import browser_failures
        receipt = dict(receipt, failures=browser_failures(read_json(browser)))
    return receipt
