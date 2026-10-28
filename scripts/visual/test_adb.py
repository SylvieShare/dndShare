"""A failed hierarchy dump must never reuse an earlier Android screen."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch
import xml.etree.ElementTree as ET

from scripts.visual import adb


class FreshHierarchyTest(unittest.TestCase):
    def test_dead_client_fails_promptly_and_saves_the_actual_runtime_log(self):
        with TemporaryDirectory() as directory:
            device=object.__new__(adb.Emulator)
            device.output=Path(directory)
            device.command=['unused']
            device.tree=Mock(return_value=ET.fromstring('<hierarchy/>'))
            device.shell=Mock(return_value='')
            with patch.object(adb.time,'monotonic',side_effect=[0,0,1,4]), patch.object(adb,'run',return_value=b'FATAL EXCEPTION: main'):
                with self.assertRaisesRegex(RuntimeError,'Smoke client exited'):device.wait(text='Sheet')
            device.shell.assert_called_once_with('pidof',adb.PACKAGE)
            self.assertEqual(b'FATAL EXCEPTION: main',(device.output/'runtime-error.log').read_bytes())

    def test_null_root_never_reads_the_old_xml(self):
        with TemporaryDirectory() as directory:
            device=object.__new__(adb.Emulator)
            device.output=Path(directory)
            device.command=['unused']
            device.shell=Mock(side_effect=['','ERROR: null root node returned by UiTestAutomationBridge.']*3)
            with patch.object(adb,'run') as read:
                with self.assertRaisesRegex(RuntimeError,'fresh UI hierarchy'):device.tree()
                read.assert_not_called()
            self.assertIn('null root',(device.output/'uiautomator-error.txt').read_text())

    def test_successful_dump_reads_and_saves_only_the_new_document(self):
        with TemporaryDirectory() as directory:
            device=object.__new__(adb.Emulator)
            device.output=Path(directory)
            device.command=['unused']
            device.shell=Mock(side_effect=['','UI hierchary dumped to: /sdcard/dndshare-ui-review.xml'])
            with patch.object(adb,'run',return_value=b'<hierarchy><node text="new"/></hierarchy>'):
                self.assertEqual('new',device.tree().find('node').get('text'))
            self.assertIn(b'new',(device.output/'latest-ui.xml').read_bytes())
            self.assertEqual(('rm','-f','/sdcard/dndshare-ui-review.xml'),device.shell.call_args_list[0].args)

    def test_empty_success_message_still_requires_a_fresh_document(self):
        with TemporaryDirectory() as directory:
            device=object.__new__(adb.Emulator)
            device.output=Path(directory)
            device.command=['unused']
            device.shell=Mock(return_value='')
            with patch.object(adb,'run',return_value=b'<hierarchy><node text="fresh"/></hierarchy>'):
                self.assertEqual('fresh',device.tree().find('node').get('text'))


if __name__=='__main__':unittest.main()
