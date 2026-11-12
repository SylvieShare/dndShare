import json
from pathlib import Path
import tempfile
import tomllib
import unittest

from auth_headers import headers
from configure_mcp import SERVER, TOOLS, configure


class NativeMCPTest(unittest.TestCase):
    def test_configuration_preserves_existing_settings_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / 'config.toml'
            original = 'model="existing-model"\n[mcp_servers.existing]\ncommand="existing-command"\n'
            target.write_text(original)
            dispatcher = root / 'dispatcher.json'
            dispatcher.write_text(json.dumps({'baseUrl': 'https://dndshare.ru'}))
            self.assertTrue(configure(target, dispatcher, 'C:/Python312/python.exe', 'C:/Private/auth_headers.py'))
            result = tomllib.loads(target.read_text())
            self.assertEqual(result['model'], 'existing-model')
            self.assertEqual(result['mcp_servers']['existing']['command'], 'existing-command')
            self.assertEqual(result['mcp_servers'][SERVER]['enabled_tools'], TOOLS)
            self.assertEqual(result['mcp_servers'][SERVER]['url'], 'https://dndshare.ru/mcp')
            self.assertFalse(configure(target, dispatcher, 'C:/Python312/python.exe', 'C:/Private/auth_headers.py'))
            self.assertEqual(len(list(root.glob('*.bak'))), 1)

    def test_an_existing_different_server_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); target = root / 'config.toml'; dispatcher = root / 'dispatcher.json'
            target.write_text('[mcp_servers.dndshare_reports]\nurl="https://other.example/mcp"\n')
            dispatcher.write_text(json.dumps({'baseUrl': 'https://dndshare.ru'}))
            before = target.read_bytes()
            with self.assertRaises(ValueError): configure(target, dispatcher, 'python', 'helper.py')
            self.assertEqual(target.read_bytes(), before)

    def test_managed_configuration_gains_timing_tool_without_touching_other_servers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); target = root / 'config.toml'; dispatcher = root / 'dispatcher.json'
            dispatcher.write_text(json.dumps({'baseUrl': 'https://dndshare.ru'}))
            configure(target, dispatcher, 'python', 'helper.py')
            raw = target.read_text().replace(', "error_report_phase_set"', '')
            target.write_text(raw + '\n[mcp_servers.another]\ncommand="keep"\n')
            self.assertTrue(configure(target, dispatcher, 'python', 'helper.py'))
            settings = tomllib.loads(target.read_text())
            self.assertIn('error_report_phase_set', settings['mcp_servers'][SERVER]['enabled_tools'])
            self.assertEqual(settings['mcp_servers']['another']['command'], 'keep')

    def test_header_helper_only_returns_the_required_authorization(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / '.env'
            env.write_text('OTHER_SECRET=not-used\nMCP_AUTH_TOKEN="test-only-secret"\n')
            self.assertEqual(headers({'tokenEnvFile': str(env)}), {'Authorization': 'Bearer test-only-secret'})


if __name__ == '__main__': unittest.main()
