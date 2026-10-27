"""Run the existing deployment/install scripts, keeping one release owner."""
from contextlib import ExitStack, contextmanager
from pathlib import Path
import os
import shutil
import signal
import subprocess
import tempfile
import time

from .common import UIError
from .runner import lock
from .windows import windows_path


@contextmanager
def web_environment(config, env):
    """Stage a configured key with Linux permissions; never print key contents."""
    key = config.get('ssh_key') or os.environ.get('SSH_KEY')
    hosts = config.get('ssh_known_hosts')
    if not key:
        yield env
        return
    with tempfile.TemporaryDirectory(prefix='dndshare-release-key-') as temporary:
        directory = Path(temporary)
        copied = directory / 'key'
        shutil.copyfile(key, copied)
        copied.chmod(0o600)
        result = dict(env, SSH_KEY=str(copied))
        if hosts:
            # deploy.sh invokes ssh/scp normally; wrappers add only host verification.
            for name in ('ssh', 'scp'):
                wrapper = directory / name
                import shlex
                wrapper.write_text('#!/bin/sh\nexec /usr/bin/' + name + ' -o BatchMode=yes -o StrictHostKeyChecking=yes -o ' +
                                   shlex.quote('UserKnownHostsFile=' + str(hosts)) + ' "$@"\n')
                wrapper.chmod(0o700)
            result['PATH'] = str(directory) + os.pathsep + result['PATH']
        yield result


def native_command(config, checkout, directory, phone=None):
    wrapper = directory / 'install.ps1'
    # All command values are arguments, not interpolated PowerShell code.
    wrapper.write_text("param([string]$Script,[string]$Serial)\n$ErrorActionPreference='Stop'\n"
                       "$env:GRADLE_OPTS='-Dorg.gradle.caching=true -Dorg.gradle.daemon=false'\n"
                       "if ($Serial) { & $Script -Serial $Serial } else { & $Script -Target Android }\nexit $LASTEXITCODE\n")
    script = checkout / ('scripts/native/install.ps1' if phone else 'scripts/native/build.ps1')
    return [config['powershell'], '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', windows_path(wrapper), '-Script', windows_path(script), *(['-Serial', phone] if phone else [])]


def deliver(run, checkout, primary, commands, env, timeout=1800):
    """Independent web/native stages overlap; child groups stop on interruption."""
    children = []
    with ExitStack() as cleanup:
        try:
            native_guard = ExitStack()
            if any(name == 'native' for name, _ in commands):
                native_guard.enter_context(lock(primary / '.git/ui-locks/native-build.lock'))
            cleanup.callback(native_guard.close)
            for name, command in commands:
                guard = native_guard if name == 'native' else ExitStack()
                output = cleanup.enter_context((run.directory / (name + '.log')).open('w'))
                child = subprocess.Popen(command, cwd=checkout, env=env, stdout=output,
                                         stderr=subprocess.STDOUT, start_new_session=True)
                row = dict(name=name, command=list(map(str, command)), started=time.time(),
                           status='running', childPid=child.pid, log=str(run.directory / (name + '.log')))
                run.receipt['stages'].append(row)
                children.append((child, row, guard))
            while any(child.poll() is None for child, _, _ in children):
                for child, row, guard in children:
                    if child.poll() is not None and row['status'] == 'running':
                        row.update(status='passed' if child.returncode == 0 else 'failed', exitCode=child.returncode, finished=time.time())
                        guard.close()
                    if time.time() - row['started'] > timeout and child.poll() is None:
                        raise UIError('Release stage timed out: ' + row['name'])
                run.save()
                time.sleep(.5)
            for child, row, guard in children:
                if row['status'] == 'running':
                    row.update(status='passed' if child.returncode == 0 else 'failed', exitCode=child.returncode, finished=time.time())
                guard.close()
            run.save()
        finally:
            for child, row, _ in children:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGTERM)
                    try:
                        child.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait()
                    row.update(status='interrupted', finished=time.time())
            run.save()
