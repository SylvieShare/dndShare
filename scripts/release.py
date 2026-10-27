#!/usr/bin/env python3
"""Build/deploy an exact commit from the shared warm release checkout on C:."""
import argparse
from contextlib import ExitStack
from pathlib import Path
import signal
import subprocess
import sys

from dev import config
from dev.common import UIError
from dev.dependencies import environment
from dev.release_checkout import prepared_release, ensure_web_dependencies
from dev.release_delivery import deliver, native_command, web_environment
from dev.runner import Run


def main(argv=None, source=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True, help='local commit to release')
    parser.add_argument('--web', action='store_true', help='run the existing deploy/deploy.sh')
    parser.add_argument('--native', action='store_true', help='build the production APK')
    parser.add_argument('--phone', help='explicit authorized ADB serial; installs in place')
    args = parser.parse_args(argv)
    source = Path(source or Path(__file__).resolve().parents[1]).resolve()
    run = Run(source, 'release')
    def interrupted(signum, frame):
        raise KeyboardInterrupt('Release interrupted')
    previous = signal.signal(signal.SIGTERM, interrupted)
    try:
        tools = config.load(source)
        with prepared_release(source, args.commit) as (checkout, sha, primary), ExitStack() as stack:
            run.receipt.update(sourceSHA=sha, workspace=str(checkout), releaseGitStatus='clean')
            commands = []
            env = environment(tools)
            # Browser/PostgreSQL compatibility libraries must not override system SSH libraries.
            env.pop('LD_LIBRARY_PATH', None)
            if args.web:
                # A requested web release must contain the newest known main, never roll it back.
                subprocess.run(['git', 'merge-base', '--is-ancestor', 'origin/main', sha], cwd=source, check=True)
                ensure_web_dependencies(checkout, tools)
                env = stack.enter_context(web_environment(tools, env))
                commands.append(('web', ['bash', str(checkout / 'deploy/deploy.sh')]))
            if args.native or args.phone:
                commands.append(('native', native_command(tools, checkout, run.directory, args.phone)))
            if commands:
                deliver(run, checkout, primary, commands, env)
            print('release checkout: ' + str(checkout), flush=True)
            print('release commit: ' + sha, flush=True)
        return run.finish()
    except (OSError, UIError, ValueError, subprocess.SubprocessError, KeyboardInterrupt) as error:
        return run.finish(error or 'Interrupted')
    finally:
        signal.signal(signal.SIGTERM, previous)


if __name__ == '__main__':
    raise SystemExit(main())
