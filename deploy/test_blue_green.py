"""Exercise the actual shell controller with isolated services, nginx and HTTP probes."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

DEPLOY = Path(__file__).resolve().parent
BASH = shutil.which('bash') if os.name != 'nt' else r'C:\Program Files\Git\bin\bash.exe'
OLD, NEW = 'a' * 40, 'b' * 40


def posix_path(path):
    value = str(path).replace('\\', '/')
    return '/' + value[0].lower() + value[2:] if os.name == 'nt' else value


class BlueGreenTest(unittest.TestCase):
    def rollout(self, failure=None, rollback=False):
        with tempfile.TemporaryDirectory(prefix='dndshare-blue-green-') as temporary:
            home = Path(temporary)
            root, state, system, binary = [home / name for name in ('dndshare-deployment', 'mock', 'etc', 'bin')]
            for folder in (state, binary, root / 'slots', root / 'releases' / OLD, root / 'releases' / NEW,
                           system / 'nginx' / 'conf.d', system / 'nginx' / 'sites-available'):
                folder.mkdir(parents=True, exist_ok=True)
            (root / 'releases' / OLD / 'commit').write_text(OLD, encoding='utf8')
            (root / 'releases' / OLD / 'dndshare').write_text('test-binary', encoding='utf8')
            (root / 'releases' / OLD / 'nginx-dndshare-http.conf').write_text('old site', encoding='utf8')
            (root / 'releases' / NEW / 'commit').write_text(NEW, encoding='utf8')
            (root / 'releases' / NEW / 'nginx-dndshare-http.conf').write_text('new site', encoding='utf8')
            (root / 'active').write_text('blue', encoding='utf8')
            (root / 'previous').write_text('green', encoding='utf8')
            (state / 'up-8080').write_text(OLD, encoding='utf8')
            (state / 'proxy').write_text('8080', encoding='utf8')
            (system / 'nginx' / 'conf.d' / 'dndshare-upstream.conf').write_text('upstream dndshare_backend { server 127.0.0.1:8080; }', encoding='utf8')
            (system / 'nginx' / 'sites-available' / 'dndshare').write_text('old site', encoding='utf8')
            if failure:
                (state / failure).touch()
            controller = home / 'activate.sh'
            controller.write_bytes((DEPLOY / 'activate-release.sh').read_text(encoding='utf8').encode('utf8'))
            mock = home / 'mock.sh'
            mock.write_bytes((DEPLOY / 'tests' / 'mock-blue-green.sh').read_text(encoding='utf8').encode('utf8'))
            for command in ('sudo', 'systemctl', 'nginx', 'curl'):
                wrapper = binary / command
                wrapper.write_bytes(b'#!/usr/bin/env bash\nexec bash "$MOCK_COMMAND" "$0" "$@"\n')
                wrapper.chmod(0o755)
            script = '''
export PATH="$MOCK_BIN:$PATH"
source "$CONTROLLER"
ln -s "$root/releases/$OLD_COMMIT" "$root/slots/blue"
(cd "$root/releases/$OLD_COMMIT"; sha256sum dndshare > binary.sha256)
trap cleanup EXIT
trap restore ERR HUP INT TERM
stage="$DNDSHARE_DEPLOY_HOME/dndshare-deploy.test"
mkdir "$stage"
switch_release "$NEW_COMMIT" "$root/releases/$NEW_COMMIT"
if [[ "$ROLLBACK" == 1 ]]; then
  finished=false
  switched=false
  target_slot=''
  rollback_release
fi
'''
            environment = dict(os.environ, DNDSHARE_DEPLOY_HOME=posix_path(home), DNDSHARE_SYSTEM_ROOT=posix_path(system),
                               DNDSHARE_DEPLOY_LIBRARY_ONLY='1', DNDSHARE_READY_ATTEMPTS='1', DNDSHARE_PROXY_ATTEMPTS='1',
                               CONTROLLER=posix_path(controller), MOCK_BIN=posix_path(binary), MOCK_COMMAND=posix_path(mock), NEW_COMMIT=NEW,
                               OLD_COMMIT=OLD, ROLLBACK='1' if rollback else '0')
            if os.name == 'nt':
                environment['MSYS'] = 'winsymlinks:sys'
            result = subprocess.run([BASH, '--noprofile', '--norc', '-c', script], env=environment, capture_output=True, text=True, timeout=30)
            active = (root / 'active').read_text(encoding='utf8').strip()
            operations = (state / 'operations').read_text(encoding='utf8').splitlines()
            up = [port for port in (8080, 8081) if (state / f'up-{port}').exists()]
            proxy = (state / 'proxy').read_text(encoding='utf8').strip()
            return result, active, operations, up, proxy

    def test_switch_waits_for_readiness_and_recovers_jobs_after_old_process_stops(self):
        result, active, operations, up, proxy = self.rollout()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((active, up, proxy), ('green', [8081], '8081'))
        self.assertLess(operations.index('reload nginx'), operations.index('stop dndshare@blue'))
        self.assertLess(operations.index('stop dndshare@blue'), operations.index('activate 8081'))

    def test_failed_candidate_or_nginx_keeps_the_previous_release(self):
        for failure in ('fail-health', 'fail-config', 'fail-reload', 'fail-proxy', 'fail-activate'):
            with self.subTest(failure=failure):
                result, active, _, up, proxy = self.rollout(failure)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual((active, up, proxy), ('blue', [8080], '8080'), result.stdout + result.stderr)

    def test_explicit_rollback_starts_and_checks_previous_slot_before_switching(self):
        result, active, operations, up, proxy = self.rollout(rollback=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((active, up, proxy), ('blue', [8080], '8080'))
        self.assertLess(operations.index('start dndshare@blue'), len(operations)-1)


if __name__ == '__main__':
    unittest.main()
