import io
import json
import unittest
from unittest.mock import patch
from install import install


class InstallationContract(unittest.TestCase):
    def test_preview_and_exact_hash(self):
        calls = []
        def response(request, **_):
            calls.append(json.loads(request.data))
            return io.BytesIO(b'{"result":{"structuredContent":{"result":{"created":0}}}}')
        with patch('urllib.request.urlopen', response):
            self.assertEqual(install('https://example.test/mcp', 'test-token')['created'], 0)
            install('https://example.test/mcp', 'test-token', 'a' * 64)
        self.assertEqual(calls[0]['params']['arguments'], {'apply': False})
        self.assertEqual(calls[1]['params']['arguments'], {'apply': True, 'expectedHash': 'a' * 64})
        with self.assertRaises(ValueError):
            install('https://example.test/mcp', 'test-token', 'wrong')

    def test_operator_error_is_not_treated_as_success(self):
        with patch('urllib.request.urlopen', return_value=io.BytesIO(b'{"result":{"isError":true}}')):
            with self.assertRaises(RuntimeError):
                install('https://example.test/mcp', 'test-token')


if __name__ == '__main__':
    unittest.main()
