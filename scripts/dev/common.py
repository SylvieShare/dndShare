"""Small filesystem and process helpers shared by the UI runner."""
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import uuid


class UIError(RuntimeError):
    pass


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def capture(command, *, cwd=None, env=None, timeout=45):
    result = subprocess.run(list(map(str, command)), cwd=cwd, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, errors="replace", timeout=timeout)
    if result.returncode:
        raise UIError(f"{command[0]} exited {result.returncode}: {result.stdout[-6000:]}")
    return result.stdout.strip()


def execute(command, cwd, env, log, timeout):
    """Keep evidence on disk; stop the whole Linux child group on timeout/interrupt."""
    with Path(log).open("w", encoding="utf-8") as output:
        process = subprocess.Popen(list(map(str, command)), cwd=cwd, env=env,
                                   stdout=output, stderr=subprocess.STDOUT,
                                   start_new_session=True)
        try:
            return process.wait(timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise


def identifier():
    return time.strftime("%Y%m%dT%H%M%S", time.gmtime()) + "-" + uuid.uuid4().hex[:10]


def linux_path(windows):
    return Path(capture(["wslpath", "-u", windows]))


def windows_path(path):
    return capture(["wslpath", "-w", str(Path(path).resolve())])
