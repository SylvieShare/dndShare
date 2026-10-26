"""Unique run evidence and guarded execution of prepared sources."""
from contextlib import contextmanager
import fcntl
from pathlib import Path
import shutil
import socket
import subprocess
import time

from .common import UIError, execute, identifier, write_json
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
        self.directory = source / "build/ui-runs" / identifier()
        self.directory.mkdir(parents=True)
        self.receipt = {"schema": 1, "command": command, "status": "running", "stages": [],
                        "run": str(self.directory), "started": time.time()}
        self.save()

    def save(self):
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
            if stage.native:
                for relative in ("native/.gradle", "native/androidApp/build", "native/designSystem/build"):
                    path = workspace / relative
                    if path.exists():
                        shutil.rmtree(path)
            code = execute(stage.command, stage.cwd, env, log, timeout)
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
            run.save()
        print(f"{stage.name}: {record['status']} ({log})", flush=True)
