#!/usr/bin/env python3
"""Fetch Lockbox through an authorized service account key, without YC metadata."""

import base64
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

IAM_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
PAYLOAD_URL = "https://payload.lockbox.api.cloud.yandex.net/lockbox/v1/secrets/{}/payload"
REQUIRED = ("DB_PASSWORD", "OBJECT_STORAGE_ACCESS_KEY", "OBJECT_STORAGE_SECRET_KEY", "MCP_AUTH_TOKEN")


def encoded(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def create_jwt(key):
    now = int(time.time())
    header = {"typ": "JWT", "alg": "PS256", "kid": key["id"]}
    claims = {"iss": key["service_account_id"], "aud": IAM_URL, "iat": now, "exp": now + 300}
    signing_input = ".".join(encoded(json.dumps(part).encode()) for part in (header, claims))
    # Neither the authorized key nor the JWT is logged. The private temp dir is 700.
    with tempfile.TemporaryDirectory(prefix="dndshare-iam-") as directory:
        pem = Path(directory) / "key.pem"
        pem.write_text(key["private_key"])
        pem.chmod(0o600)
        result = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", str(pem), "-sigopt", "rsa_padding_mode:pss",
             "-sigopt", "rsa_pss_saltlen:digest"],
            input=signing_input.encode(), capture_output=True, timeout=10,
        )
        if result.returncode:
            raise ValueError("Cannot sign IAM JWT with the service account key")
    return signing_input + "." + encoded(result.stdout)


def request_json(url, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
            if not isinstance(result, dict):
                raise ValueError("Cloud API returned an invalid JSON object")
            return result
    except urllib.error.HTTPError as error:
        # Response bodies may contain sensitive data; report status only.
        raise ValueError(f"Cloud API returned HTTP {error.code}") from None
    except urllib.error.URLError:
        raise ValueError("Cloud API is unreachable or TLS verification failed") from None


def payload_env(payload):
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Lockbox payload contains no entries")
    values = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Lockbox payload contains an invalid entry")
        key, value = entry.get("key", ""), entry.get("textValue")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Z_][A-Z0-9_]*", key) or key in values:
            raise ValueError("Lockbox payload contains invalid or duplicate environment names")
        if not isinstance(value, str) or "\0" in value:
            raise ValueError("Lockbox payload must contain text environment values")
        values[key] = value
    if any(not values.get(key) or values[key] in ("changeme", "dev-mcp-token-change-me") for key in REQUIRED):
        raise ValueError("Lockbox payload is missing required production credentials")
    return "".join(f"{key}={shlex.quote(value)}\n" for key, value in values.items())


def write_env(path, content):
    # Validate before replacing the previous file; mkstemp starts at mode 600.
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=".dndshare-env-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fetch(path):
    secret_id = os.environ.get("LOCKBOX_SECRET_ID", "")
    key_path = os.environ.get("LOCKBOX_SERVICE_ACCOUNT_KEY_FILE", "")
    if not re.fullmatch(r"[a-z0-9]+", secret_id) or not key_path:
        raise ValueError("Set LOCKBOX_SECRET_ID and LOCKBOX_SERVICE_ACCOUNT_KEY_FILE")
    with open(key_path) as source:
        key = json.load(source)
    if not isinstance(key, dict):
        raise ValueError("Invalid service account key JSON object")
    token = request_json(IAM_URL, {"jwt": create_jwt(key)}).get("iamToken")
    if not isinstance(token, str) or not token:
        raise ValueError("IAM API returned no token")
    payload = request_json(PAYLOAD_URL.format(secret_id), token=token)
    write_env(path, payload_env(payload))
    print("Lockbox environment updated (mode 600)")


if __name__ == "__main__":
    try:
        fetch(sys.argv[1])
    except (OSError, ValueError, KeyError, IndexError, subprocess.SubprocessError) as error:
        message = "Invalid JSON from key file or Cloud API" if isinstance(error, json.JSONDecodeError) else str(error)
        print("Lockbox: " + message, file=sys.stderr)
        sys.exit(1)
