"""Scope, warm-candidate and liveness regressions. No SDK or full test suites run."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from scripts.dev.cli import parser, main
from scripts.dev.policy import check_scope
from scripts.dev.common import UIError, write_json
from scripts.dev.runner import Run, read_status
from scripts.dev import snapshot
from scripts.dev import config
from scripts.dev.triage import classify
from scripts.dev.windows import runtime_health


class WorkflowTest(unittest.TestCase):
    def args(self, *args):
        return parser().parse_args([*args, '--workspace', '/tmp/project'])

    def test_broad_runs_need_explicit_opt_in_and_never_start_doctor_accidentally(self):
        for args in [('verify',), ('focus', 'browser'), ('focus', 'webunit'), ('review',)]:
            with self.subTest(args=args), self.assertRaises(UIError): check_scope(self.args(*args))
        with patch('scripts.dev.cli.doctor.inspect') as doctor:
            self.assertEqual(main(['verify', '--workspace', '/tmp/project'], Path('/tmp/project')), 2)
            doctor.assert_not_called()
        for args in [('verify', '--full'), ('focus', 'browser', '--file', 'tests/a.spec.js'),
                     ('review', '--scenario', 'form-lifecycle'), ('review', '--state', 'sheet-stats')]:
            check_scope(self.args(*args))

    def test_a_dead_runner_is_not_reported_as_running_or_passed(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = Run(Path(tmp), 'focus')
            self.assertEqual(read_status(run.directory)['status'], 'running')
            with patch('scripts.dev.runner.process_identity', return_value='another-start'):
                self.assertEqual(read_status(run.directory)['status'], 'interrupted')
            self.assertEqual(json.loads((run.directory/'receipt.json').read_text())['status'], 'running')

    def test_pin_preserves_build_outputs_and_reuses_the_same_worktree(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)/'main';base.mkdir()
            subprocess.run(['git','init','-q',base],check=True)
            (base/'.gitignore').write_text('build/\nnode_modules/\n.ui-workspace.json\n.ui-run.lock\n')
            (base/'frontend').mkdir();(base/'frontend/package-lock.json').write_text('{}')
            subprocess.run(['git','add','.'],cwd=base,check=True)
            subprocess.run(['git','-c','user.name=Test','-c','user.email=test@local','commit','-qm','fixture'],cwd=base,check=True)
            work = Path(tmp)/'work';subprocess.run(['git','worktree','add','--detach',work,'HEAD'],cwd=base,check=True,stdout=subprocess.DEVNULL)
            modules=Path(tmp)/'modules';modules.mkdir()
            config={'node_modules':str(modules)}
            _,first=snapshot.pin(work,config)
            artifact=work/'native/androidApp/build/keep.apk';artifact.parent.mkdir(parents=True);artifact.write_bytes(b'cache')
            (work/'README.md').write_text('new source')
            _,second=snapshot.pin(work,config)
            self.assertNotEqual(first['sourceHash'],second['sourceHash'])
            self.assertEqual(first['hotCache'],second['hotCache'])
            self.assertEqual(artifact.read_bytes(),b'cache')
            snapshot.validate(work,work,config)
            import shutil;shutil.rmtree(second['hotCache'])

    def test_new_worktree_reuses_primary_installed_tools_without_discovery_or_download(self):
        if not str(Path.cwd()).lower().startswith('/mnt/c/'):
            self.skipTest('Local configuration is supported on Windows/WSL C: only')
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as tmp:
            primary = Path(tmp) / 'main'; work = Path(tmp) / 'work'
            (primary / '.git').mkdir(parents=True); work.mkdir(); (work / '.git').write_text('gitdir: fixture')
            expected = {'schema': 1, 'source': str(primary), 'node': '/installed/node', 'android_home': 'C:\\SDK'}
            write_json(primary / 'build/dev-tools/local-tools.json', expected)
            with patch('scripts.dev.config.capture', return_value=str(primary / '.git')), \
                    patch('scripts.dev.config.windows.discover') as discover:
                actual = config.load(work)
                self.assertEqual(config.load(work), actual)
            self.assertEqual(actual['node'], expected['node'])
            self.assertEqual(actual['source'], str(work))
            self.assertEqual(actual['android_home'], expected['android_home'])
            discover.assert_not_called()

    def test_environment_probe_reports_actual_renderer_and_refuses_visible_auto_runs(self):
        def capture(cmd, **kwargs):
            if 'SurfaceFlinger' in cmd: return 'GLES: Google, NVIDIA RTX, OpenGL ES 3.1\n'
            if 'avd' in cmd: return 'Test_AVD\nOK'
            return 'ui-health'
        with patch('scripts.dev.windows.capture',side_effect=capture), patch('scripts.dev.windows.powershell',return_value='{"headless":true,"availableRamGB":5.4,"cpuLoad":10}'):
            info=runtime_health({'powershell':'ps'},'adb','emulator-5554')
            self.assertIn('NVIDIA',info['renderer'])
        with patch('scripts.dev.windows.capture',side_effect=capture), patch('scripts.dev.windows.powershell',return_value='{"headless":false,"availableRamGB":5.4,"cpuLoad":10}'):
            with self.assertRaisesRegex(UIError,'no-window'):runtime_health({'powershell':'ps'},'adb','emulator-5554')

    def test_known_failures_are_annotations_and_never_green(self):
        data=json.loads(Path('scripts/dev/known-failures.json').read_text())['entries'][0]
        result=classify(data['file'],data['title'],data['project'])
        self.assertTrue(result['known']);self.assertFalse(result['passes'])
        self.assertFalse(classify('unknown','unknown','ui')['known'])
