import os
import base64
import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from retention import apply_plan, capture_manifest, plan


class RetentionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='dndshare-retention-')
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name).resolve()
        self.root = self.home / 'dndshare-deployment'
        self.assets = self.home / 'dndshare-frontend-assets' / 'static'
        (self.root / 'releases').mkdir(parents=True)
        (self.root / 'slots').mkdir()
        self.assets.mkdir(parents=True)
        (self.root / 'active').write_text('blue')
        (self.root / 'previous').write_text('green')
        self.commits = [f'{i:040x}' for i in range(8)]
        for index, commit in enumerate(self.commits):
            directory = self.root / 'releases' / commit
            directory.mkdir()
            (directory / 'commit').write_text(commit)
            (directory / 'frontend.sha256').write_text('a'*64+'  ./static/current.js\n')
            os.utime(directory, (100+index,100+index))
        (self.root / 'slots' / 'blue').symlink_to(self.root / 'releases' / self.commits[0], target_is_directory=True)
        (self.root / 'slots' / 'green').symlink_to(self.root / 'releases' / self.commits[1], target_is_directory=True)

    def asset(self, name, days):
        target = self.assets / name
        target.write_text('compiled asset')
        when = time.time()-days*86400
        os.utime(target,(when,when))
        return target

    def test_pins_both_slots_and_preserves_current_and_recent_asset_groups(self):
        self.asset('current.js',90)
        self.asset('current.js.gz',90)
        stale = self.asset('old.js',90)
        self.asset('old.js.gz',90)
        self.asset('in-use.js',90)
        self.asset('in-use.js.gz',1)
        self.asset('young.js',1)
        result = plan(self.root,self.assets)
        self.assertEqual(result['releases'],[str(self.root/'releases'/self.commits[2])])
        self.assertEqual(set(result['assets']),{str(stale),str(self.assets/'old.js.gz')})
        apply_plan(result,self.root,self.assets)
        self.assertTrue((self.assets/'current.js').is_file())
        self.assertTrue((self.assets/'in-use.js').is_file())
        self.assertFalse(stale.exists())

    def test_legacy_manifest_stops_asset_cleanup(self):
        (self.root/'releases'/self.commits[0]/'frontend.sha256').unlink()
        self.asset('old.js',90)
        result=plan(self.root,self.assets)
        self.assertTrue(result['assetCleanupSkipped'])
        self.assertEqual(result['assets'],[])

    def test_unsafe_state_manifest_and_paths_fail_closed(self):
        (self.root/'active').write_text('../../documents')
        with self.assertRaises(ValueError):plan(self.root,self.assets)
        (self.root/'active').write_text('blue')
        (self.root/'releases'/self.commits[0]/'frontend.sha256').write_text('a'*64+'  ../../documents\n')
        with self.assertRaises(ValueError):plan(self.root,self.assets)
        with self.assertRaises(ValueError):plan(self.home,self.assets)

    def test_cache_symlinks_are_never_followed(self):
        outside=self.home/'important.txt'
        outside.write_text('keep')
        (self.assets/'old.js').symlink_to(outside)
        self.asset('old.js.gz',90)
        result=plan(self.root,self.assets)
        self.assertEqual(result['assets'],[])
        self.assertEqual(outside.read_text(),'keep')

    def test_inventory_migration_is_bound_to_the_active_commit(self):
        manifest=self.root/'releases'/self.commits[0]/'frontend.sha256'
        manifest.unlink()
        def response(commit,path):
            payload=json.dumps(dict(commitSha=commit,files=[dict(path=path,sha256='a'*64)])).encode()
            return io.BytesIO(json.dumps(dict(payload=base64.b64encode(payload).decode())).encode())
        with patch('retention.urllib.request.urlopen',return_value=response(self.commits[1],'static/other.js')):
            with self.assertRaises(ValueError):capture_manifest(self.root,8080)
        self.assertFalse(manifest.exists())
        with patch('retention.urllib.request.urlopen',return_value=response(self.commits[0],'../../important.txt')):
            with self.assertRaises(ValueError):capture_manifest(self.root,8080)
        self.assertFalse(manifest.exists())
        with patch('retention.urllib.request.urlopen',return_value=response(self.commits[0],'static/current.js')):
            capture_manifest(self.root,8080)
        self.assertIn('./static/current.js',manifest.read_text())


if __name__=='__main__':unittest.main()
