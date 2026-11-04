"""Exercise build, transfer and activation against a disposable local VM substitute."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
OLD = '1' * 40
NEWER = '2' * 40

STUBS = {
    'npm': '''
[[ "$*" == 'run build' ]] || exit 1
printf 'build\n' >> ../build/frontend-builds
mkdir -p target/dist/static
printf 'new UI' > target/dist/static/new.js
''',
    'go': '''
while [[ "$#" -gt 1 ]]; do
    if [[ "$1" == '-o' ]]; then { printf '\177ELF'; git rev-parse HEAD; } > "$2"; exit; fi
    shift
done
exit 1
''',
    'ssh': '''
command="${!#}"
case "$command" in
    'bash -s')
        path="$(mktemp -d "$DNDSHARE_TEST_REMOTE/dndshare-deploy.XXXXXX")"
        printf '%s %s\n' "$path" "$(tail -c 41 "$DNDSHARE_TEST_REMOTE/dndshare")"
        ;;
    'bash -s -- '*)
        {
            printf '%s\n' 'curl() { "$DNDSHARE_TEST_TOOLS/curl" "$@"; }'
            printf '%s\n' 'sudo() { "$DNDSHARE_TEST_TOOLS/sudo" "$@"; }'
            printf '%s\n' 'flock() { "$DNDSHARE_TEST_TOOLS/flock" "$@"; }'
            sed 's|release_root="$HOME"|release_root="$DNDSHARE_TEST_REMOTE"|'
        } | bash -c "$command"
        ;;
    *) exit 1 ;;
esac
''',
    'scp': '''
from="${@: -2:1}"
to="${!#}"
cp -- "$from" "${to#*:}"
sha256sum "$from" >> "$DNDSHARE_TEST_REMOTE/transfers"
if [[ -n "${DNDSHARE_TEST_CORRUPT:-}" ]]; then printf 'corrupt' >> "${to#*:}"; fi
if [[ -n "${DNDSHARE_TEST_NEWER:-}" ]]; then
    printf '\177ELF%s\n' "$DNDSHARE_TEST_NEWER" > "$DNDSHARE_TEST_REMOTE/dndshare"
fi
''',
    'curl': '''
printf '{"status":"ok","commitSha":"%s"}' "$(tail -c 41 "$DNDSHARE_TEST_REMOTE/dndshare")"
''',
    'sudo': '''
printf '%s\n' "$*" >> "$DNDSHARE_TEST_REMOTE/service-calls"
''',
    'flock': 'true',
}


class TesterReleaseTest(unittest.TestCase):
    def setUp(self):
        self.bash = (Path(os.environ['ProgramFiles']) / 'Git/bin/bash.exe'
                     if os.name == 'nt' else shutil.which('bash'))
        if not self.bash or not Path(self.bash).exists():
            self.skipTest('Bash is required')
        (ROOT / 'build').mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(dir=ROOT / 'build', prefix='release-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.checkout = self.root / 'source'
        self.remote = self.root / 'vm'
        self.tools = self.root / 'tools'
        for directory in (self.checkout / 'deploy', self.remote, self.tools,
                          self.checkout / 'frontend/node_modules/.bin', self.checkout / 'internal/assets/dist'):
            directory.mkdir(parents=True)
        (self.checkout / '.gitignore').write_text(
            'build/\nfrontend/node_modules/\nfrontend/target/\ninternal/assets/dist/*\n!internal/assets/dist/.gitkeep\n',
            encoding='ascii', newline='\n',
        )
        (self.checkout / 'internal/assets/dist/.gitkeep').write_bytes(b'\n')
        (self.checkout / 'frontend/node_modules/.bin/vite').touch()
        for name in ('deploy.sh', 'activate-release.sh', 'dndshare.service', 'dndshare-run.sh',
                     'fetch-secrets.py', 'nginx-dndshare.conf', 'nginx-dndshare-http.conf',
                     'journald-storage.conf', 'certbot-reload-nginx.sh'):
            shutil.copyfile(ROOT / 'deploy' / name, self.checkout / 'deploy' / name)
        (self.checkout / 'deploy/fetch-secrets.sh').write_bytes(b'#!/usr/bin/env bash\nexit 0\n')
        for name, body in STUBS.items():
            file = self.tools / name
            file.write_bytes(('#!/usr/bin/env bash\nset -euo pipefail\n' + body + '\n').encode())
            file.chmod(0o755)
        self.git('init', '-q')
        self.git('-c', 'core.autocrlf=false', 'add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-qm', 'test release')
        self.sha = self.git('rev-parse', 'HEAD')
        self.binary = self.remote / 'dndshare'
        self.binary.write_bytes(b'\x7fELF' + (OLD + '\n').encode())
        for name in ('dndshare-run.sh', 'fetch-secrets.sh', 'fetch-secrets.py'):
            (self.remote / name).write_bytes(b'previous runtime helper\n')
        old_asset = self.remote / 'dndshare-frontend-assets/static/old.js'
        old_asset.parent.mkdir(parents=True)
        old_asset.write_text('old UI')
        self.env = dict(os.environ, PATH=str(self.tools) + os.pathsep + os.environ['PATH'],
                        DNDSHARE_TEST_REMOTE=self.shell_path(self.remote), VM_HOST='127.0.0.1',
                        DNDSHARE_TEST_TOOLS=self.shell_path(self.tools),
                        VM_USER='invalid-test-user', SSH_KEY=str(self.root / 'no-ssh-key'),
                        DNDSHARE_RELEASE_SSH=self.shell_path(self.tools / 'ssh'),
                        DNDSHARE_RELEASE_SCP=self.shell_path(self.tools / 'scp'),
                        GO=self.shell_path(self.tools / 'go'))

    def shell_path(self, path):
        if os.name == 'nt':
            return subprocess.check_output([self.bash, '-c', 'cygpath -u "$1"', '_', path], text=True).strip()
        return str(path)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.checkout, text=True).strip()

    def deploy(self, mode, expected=0, **variables):
        result = subprocess.run([self.bash, 'deploy/deploy.sh', mode], cwd=self.checkout,
                                env=dict(self.env, **variables), capture_output=True, text=True,
                                encoding='utf-8', errors='replace', timeout=40)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result.stdout + result.stderr

    def test_checked_archive_publishes_once_and_rolls_back_to_the_previous_binary(self):
        self.deploy('--prepare')
        archive = self.checkout / 'build/web-release/release.tar.gz'
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        ui = self.checkout / 'frontend/target/dist/static/new.js'
        ui.write_text('not the prepared UI')
        self.assertIn('Frontend output changed', self.deploy('--publish', expected=1))
        self.assertFalse((self.remote / 'transfers').exists())
        ui.write_text('new UI')
        self.assertIn(self.sha, self.deploy('--publish'))
        self.assertEqual(self.binary.read_bytes()[4:].strip().decode(), self.sha)
        self.assertEqual((self.checkout / 'build/frontend-builds').read_text().splitlines(), ['build'])
        transfers = (self.remote / 'transfers').read_text().splitlines()
        self.assertEqual([line.split()[0] for line in transfers], [digest])
        self.assertIn(OLD, self.deploy('--rollback'))
        self.assertEqual(self.binary.read_bytes()[4:].strip().decode(), OLD)
        self.assertEqual((self.remote / 'fetch-secrets.sh').read_bytes(), b'previous runtime helper\n')
        assets = self.remote / 'dndshare-frontend-assets/static'
        self.assertEqual(sorted(file.name for file in assets.iterdir()), ['new.js', 'old.js'])

    def test_transfer_corruption_or_concurrent_release_does_not_stop_service(self):
        self.deploy('--prepare')
        self.assertIn('FAILED', self.deploy('--publish', expected=1, DNDSHARE_TEST_CORRUPT='1'))
        self.assertEqual(self.binary.read_bytes()[4:].strip().decode(), OLD)
        self.assertIn('active commit changed',
                      self.deploy('--publish', expected=1, DNDSHARE_TEST_NEWER=NEWER))
        self.assertEqual(self.binary.read_bytes()[4:].strip().decode(), NEWER)
        self.assertFalse((self.remote / 'service-calls').exists())
