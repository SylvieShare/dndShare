"""Warm releases preserve compiler outputs and refuse source changes."""
from pathlib import Path
import json
import subprocess
import tempfile
import sys
import unittest

from scripts.dev.common import UIError
from scripts.dev.release_checkout import prepared_release, ensure_web_dependencies
from scripts.dev.release_delivery import deliver
from scripts.dev.release_delivery import web_environment
from scripts.dev.runner import Run


class ReleaseTest(unittest.TestCase):
    def git(self, root, *args):
        return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.DEVNULL).decode().strip()

    def test_commit_switch_keeps_build_outputs_but_dirty_sources_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'main'; root.mkdir()
            self.git(root, 'init', '-q')
            (root / '.gitignore').write_text('build/\n')
            (root / 'source.txt').write_text('one')
            self.git(root, 'add', '.')
            self.git(root, '-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-qm', 'one')
            one = self.git(root, 'rev-parse', 'HEAD')
            with prepared_release(root, one) as (checkout, sha, _):
                self.assertEqual(sha, one)
                (checkout / 'build').mkdir(); (checkout / 'build/cached.apk').write_bytes(b'compiled')
            (root / 'source.txt').write_text('two')
            self.git(root, '-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-qam', 'two')
            two = self.git(root, 'rev-parse', 'HEAD')
            with prepared_release(root, two) as (again, sha, _):
                self.assertEqual(again, checkout)
                self.assertEqual(sha, two)
                self.assertEqual((again / 'source.txt').read_text(), 'two')
                self.assertEqual((again / 'build/cached.apk').read_bytes(), b'compiled')
            (checkout / 'source.txt').write_text('uncommitted work')
            with self.assertRaisesRegex(UIError, 'source changes'):
                with prepared_release(root, one):
                    self.fail('Dirty release source must never be overwritten')
            self.assertEqual((checkout / 'source.txt').read_text(), 'uncommitted work')

    def test_dependency_upgrade_preserves_existing_vite_caches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            checkout = root / 'release'
            frontend = checkout / 'frontend'
            frontend.mkdir(parents=True)
            modules = root / 'installed/node_modules'
            packages = {'node_modules/@scope/ui': {'version': '0.46.0'},
                        'node_modules/playwright-core': {'version': '1.63.0'}}
            (frontend / 'package-lock.json').write_text(json.dumps({'packages': packages}))
            for name, package in packages.items():
                installed = modules.parent / name
                installed.mkdir(parents=True)
                (installed / 'package.json').write_text(json.dumps(package))
                old = frontend / name
                old.mkdir(parents=True)
                (old / 'package.json').write_text(json.dumps({'version': '0.45.1'}))
            hot = checkout / 'build/vite-cache'
            for name in ('.vite', '.vite-temp', '.cache'):
                cached = hot / name
                cached.mkdir(parents=True)
                (cached / 'compiled').write_bytes(b'keep existing cache')
            config = {'node_modules': str(modules)}
            ensure_web_dependencies(checkout, config)
            ensure_web_dependencies(checkout, config)
            self.assertEqual(json.loads((frontend / 'node_modules/@scope/ui/package.json').read_text())['version'], '0.46.0')
            for name in ('.vite', '.vite-temp', '.cache'):
                self.assertEqual((frontend / 'node_modules' / name).resolve(), (hot / name).resolve())
                self.assertEqual((hot / name / 'compiled').read_bytes(), b'keep existing cache')

    def test_failed_delivery_keeps_real_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); run = Run(root, 'release')
            deliver(run, root, root, [('web', ['sh', '-c', 'exit 7'])], {})
            self.assertEqual(run.finish(), 1)
            self.assertEqual(run.receipt['stages'][0]['exitCode'], 7)

    def test_web_and_native_stages_really_overlap(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); run = Run(root, 'release')
            commands = []
            for own, other in [('web', 'native'), ('native', 'web')]:
                script = ("from pathlib import Path\nimport time\n" +
                          f"Path('{own}.started').touch()\ndeadline=time.monotonic()+5\n" +
                          f"while not Path('{other}.started').exists() and time.monotonic()<deadline: time.sleep(.05)\n" +
                          f"assert Path('{other}.started').exists(), 'stages were serialized'\n")
                commands.append((own, [sys.executable, '-c', script]))
            deliver(run, root, root, commands, {})
            self.assertTrue(all(row['exitCode'] == 0 for row in run.receipt['stages']))

    def test_ssh_key_is_private_and_temporary_even_on_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            key = Path(tmp) / 'dummy-key'; key.write_bytes(b'not-a-real-key')
            with self.assertRaisesRegex(RuntimeError, 'stop'):
                with web_environment({'ssh_key': str(key), 'ssh_known_hosts': str(Path(tmp) / 'known hosts')}, {'PATH': '/usr/bin'}) as env:
                    staged = Path(env['SSH_KEY'])
                    self.assertEqual(staged.stat().st_mode & 0o777, 0o600)
                    self.assertEqual(staged.read_bytes(), key.read_bytes())
                    self.assertIn('StrictHostKeyChecking=yes', (staged.parent / 'ssh').read_text())
                    raise RuntimeError('stop')
            self.assertFalse(staged.exists())
