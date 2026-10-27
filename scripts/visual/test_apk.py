"""Compilation cache invalidates source changes and corruption, not new API ports."""
from contextlib import nullcontext
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from apk import obtain, API_BASE


class ApkTest(unittest.TestCase):
    def test_compilation_is_reused_but_modified_or_corrupt_inputs_rebuild(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'native/src/main').mkdir(parents=True)
            source=root/'native/src/main/code.kt';source.write_text('source')
            (root/'scripts/native').mkdir(parents=True)
            for name in ('build.ps1','test-results.ps1'):(root/'scripts/native'/name).write_text('tool')
            output=root/'output';output.mkdir()
            artifact=root/'native/androidApp/build/outputs/apk/debug/androidApp-debug.apk'
            def compile(*args,**kwargs):
                artifact.parent.mkdir(parents=True,exist_ok=True);artifact.write_bytes(b'apk')
            with patch('apk.build_lock',return_value=nullcontext()),patch('apk.native_path',side_effect=str),patch('apk.powershell_path',return_value='ps'),patch('apk.subprocess.run',side_effect=compile) as builds:
                first,a=obtain(root,output);self.assertFalse(a['reused'])
                _,b=obtain(root,output);self.assertTrue(b['reused']);self.assertEqual(builds.call_count,1)
                source.write_text('changed');new,_=obtain(root,output);self.assertNotEqual(first,new);self.assertEqual(builds.call_count,2)
                new.write_bytes(b'corrupt');_,c=obtain(root,output);self.assertFalse(c['reused']);self.assertEqual(builds.call_count,3)
                self.assertEqual(c['apiBase'],API_BASE)
