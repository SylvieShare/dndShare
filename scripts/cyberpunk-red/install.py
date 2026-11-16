"""Explicit Core catalogue install through MCP; preview by default, no secrets printed."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import urllib.request


def configured_token(env_file=None):
    if os.environ.get('MCP_AUTH_TOKEN'):
        return os.environ['MCP_AUTH_TOKEN']
    if env_file:
        for line in Path(env_file).expanduser().read_text(encoding='utf-8').splitlines():
            key, sep, value = line.removeprefix('export ').partition('=')
            if sep and key.strip() == 'MCP_AUTH_TOKEN':
                return shlex.split(value)[0]
    raise RuntimeError('MCP_AUTH_TOKEN is not configured')


def install(url, token, expected_hash=None):
    if expected_hash is not None and not re.fullmatch(r'[a-f0-9]{64}', expected_hash):
        raise ValueError('An exact preview hash is required')
    arguments = {'apply': expected_hash is not None}
    if expected_hash:
        arguments['expectedHash'] = expected_hash
    body = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
            'params': {'name': 'cyberpunk_red_install', 'arguments': arguments}}
    request = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
    if result.get('error') or result.get('result', {}).get('isError'):
        raise RuntimeError('Catalogue operation failed; inspect server logs')
    return result['result']['structuredContent']['result']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='https://dndshare.ru/mcp')
    parser.add_argument('--env-file')
    parser.add_argument('--expected-hash', help='Apply the exact reviewed preview; omitted means preview')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    receipt = install(args.url, configured_token(args.env_file), args.expected_hash)
    text = json.dumps(receipt, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + '\n', encoding='utf-8')
    print(text)
