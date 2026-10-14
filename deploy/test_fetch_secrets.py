import base64
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fetch_secrets", DEPLOY / "fetch-secrets.py")
secrets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(secrets)


def payload(**overrides):
    values = dict.fromkeys(secrets.REQUIRED, "production-test-value")
    values.update(overrides)
    return {"entries": [{"key": key, "textValue": value} for key, value in values.items()]}


class FetchSecretsTest(unittest.TestCase):
    def test_values_roundtrip_through_bash_without_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            sentinel = Path(directory) / "executed"
            value = f"pa'ss with spaces\n$(touch {sentinel}) `false` \\ $HOME"
            env = Path(directory) / "test.env"
            secrets.write_env(env, secrets.payload_env(payload(DB_PASSWORD=value)))
            result = subprocess.run(
                ["bash", "-c", 'source "$1"; printf "%s" "$DB_PASSWORD"', "bash", str(env)],
                check=True, capture_output=True, text=True,
            )
            self.assertEqual(result.stdout, value)
            self.assertFalse(sentinel.exists())
            self.assertEqual(stat.S_IMODE(env.stat().st_mode), 0o600)

    def test_invalid_payload_never_replaces_old_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / "test.env"
            env.write_text("original")
            for invalid in ({}, {"entries": []}, payload(DB_PASSWORD=""), payload(DB_PASSWORD="changeme"),
                            payload(DB_PASSWORD="contains\0nul"), {"entries": [{"key": "X;false", "textValue": "v"}]},
                            {"entries": [{"key": "X", "textValue": "a"}, {"key": "X", "textValue": "b"}]}):
                with self.subTest(payload=invalid), self.assertRaises(ValueError):
                    secrets.write_env(env, secrets.payload_env(invalid))
                self.assertEqual(env.read_text(), "original")

    def test_iam_http_failure_is_reported_without_response_body(self):
        error = secrets.urllib.error.HTTPError(secrets.IAM_URL, 403, "private response", {}, None)
        with patch.object(secrets.urllib.request, "urlopen", side_effect=error):
            with self.assertRaisesRegex(ValueError, "^Cloud API returned HTTP 403$"):
                secrets.request_json(secrets.IAM_URL, {"jwt": "test"})

    def test_jwt_signature_and_claims_match_ps256(self):
        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory) / "private.pem"
            public = Path(directory) / "public.pem"
            subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048",
                            "-out", str(private)], check=True, capture_output=True)
            subprocess.run(["openssl", "pkey", "-in", str(private), "-pubout", "-out", str(public)],
                           check=True, capture_output=True)
            with patch.object(secrets.time, "time", return_value=1234567890):
                jwt = secrets.create_jwt({"id": "test-key", "service_account_id": "test-sa",
                                          "private_key": private.read_text()})
            header, claims, signature = jwt.split(".")
            decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
            self.assertEqual(json.loads(decode(header)), {"typ": "JWT", "alg": "PS256", "kid": "test-key"})
            self.assertEqual(json.loads(decode(claims)), {"iss": "test-sa", "aud": secrets.IAM_URL,
                                                       "iat": 1234567890, "exp": 1234568190})
            signature_file = Path(directory) / "signature"
            signature_file.write_bytes(decode(signature))
            subprocess.run(["openssl", "dgst", "-sha256", "-verify", str(public), "-signature", str(signature_file),
                            "-sigopt", "rsa_padding_mode:pss", "-sigopt", "rsa_pss_saltlen:32"],
                           input=f"{header}.{claims}".encode(), check=True, capture_output=True)

    def test_unit_database_and_cookie_settings_override_old_secret_values(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            fetch = home / "fetch-secrets.sh"
            fetch.write_text('#!/bin/bash\nexit 0\n')
            fetch.chmod(0o700)
            (home / "dndshare.env").write_text(secrets.payload_env(payload(
                DB_URL="old-database", DB_USER="old-user", SESSION_SECURE_COOKIE="false")))
            binary = home / "dndshare"
            binary.write_text('#!/bin/bash\nprintf "%s\\n" "$DB_URL" "$DB_USER" "$SESSION_SECURE_COOKIE"\n')
            binary.chmod(0o700)
            result = subprocess.run(["bash", str(DEPLOY / "dndshare-run.sh")], check=True, capture_output=True,
                                    text=True, env={**os.environ, "HOME": str(home), "DB_URL": "new-database",
                                                    "DB_USER": "new-user", "SESSION_SECURE_COOKIE": "true"})
            self.assertEqual(result.stdout.splitlines(), ["new-database", "new-user", "true"])


if __name__ == "__main__":
    unittest.main()
