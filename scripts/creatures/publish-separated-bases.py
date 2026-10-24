#!/usr/bin/env python3
"""Publish separated miniatures/bases via MCP, preserving live metadata and bindings.

Dry-run is local only. Uses configured MCP_AUTH_TOKEN; --server-token requires
explicit user permission to read only that variable from ~/dndshare.env on VM.
Credentials are neither saved nor printed.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
parser.add_argument('--publish', action='store_true')
parser.add_argument('--server-token', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
directory = args.directory.resolve()
upload = directory / 'publish'
models = json.loads((upload / 'catalogue.json').read_text())
report = {r['id']: r for r in json.loads((directory / 'separation-report.json').read_text())}
assert len(models) == 24 and len({m['id'] for m in models}) == 24
for m in models:
    assert set(m['assets']) == {'render', 'lod', 'source', 'shadow', 'preview'}
    for asset in m['assets'].values():
        data = (upload / Path(asset['key']).name).read_bytes()
        assert len(data) == asset['size'] and hashlib.sha256(data).hexdigest() == asset['sha256']
if not args.publish:
    print(json.dumps({'dryRun': True, 'bodies': 10, 'bases': 14,
        'bytes': sum(a['size'] for m in models for a in m['assets'].values())}))
    raise SystemExit(0)
token = os.environ.get('MCP_AUTH_TOKEN')
if not token and args.server_token:
    code = "import pathlib,shlex; values=[line.partition('=')[2] for line in pathlib.Path.home().joinpath('dndshare.env').read_text().splitlines() if line.startswith('MCP_AUTH_TOKEN=')]; assert len(values)==1; print(shlex.split(values[0])[0])"
    token = subprocess.check_output(['ssh', '-i', str(Path.home() / '.ssh/dndshare'),
        'sylvieshare@72.56.16.183', 'python3 -c ' + shlex.quote(code)], text=True).strip()
if not token:
    raise RuntimeError('Configured MCP_AUTH_TOKEN is required')

def call(name, arguments):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
        'params': {'name': name, 'arguments': arguments}}).encode()
    req = urllib.request.Request('https://dndshare.ru/mcp', data=body,
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req, timeout=120) as response:
        value = json.load(response)
    if value.get('error') or value.get('result', {}).get('isError'):
        raise RuntimeError('MCP operation failed: ' + name)
    return value['result']['structuredContent']['result']

bindings = call('item_models_list', {'itemId': 0})
current = {m['id']: m for m in call('map_tile_models_list', {})}
before = []
planned = []
for m in models:
    old = current.get(m['id'])
    if m['category'] == 'creature-base':
        if old:
            assert old['category'] == m['category'] and old['baseSize'] == m['baseSize']
            before.append(old)
        planned.append(m)
        continue
    assert old, 'Existing miniature UUID required'
    # A reviewed source snapshot protects against replacing unrelated newer art.
    expected = report[m['id']]['previousAssets']
    assert old['assets'] in (expected, m['assets']), 'Model changed since asset review'
    before.append(old)
    planned.append(dict(old, assets=m['assets'], maxHeight=m['maxHeight']))
(directory / 'before-models.json').write_text(json.dumps(before, ensure_ascii=False, indent=2) + '\n')
(directory / 'before-bindings.json').write_text(json.dumps(bindings, indent=2) + '\n')
prepared = directory / 'publish-live'
prepared.mkdir(exist_ok=True)
for m in planned:
    for asset in m['assets'].values():
        file = Path(asset['key']).name
        if not (prepared / file).exists():
            os.link(upload / file, prepared / file)
(prepared / 'catalogue.json').write_text(json.dumps(planned, ensure_ascii=False, indent=2) + '\n')
subprocess.run(['go', 'run', './cmd/map-model-upload', '-assets', str(prepared), '-workers', '2'],
    cwd=root, env=dict(os.environ, MCP_AUTH_TOKEN=token, GOCACHE='/private/tmp/dndshare-go-cache'), check=True)
assert call('item_models_list', {'itemId': 0}) == bindings, 'Item bindings changed'
published = {m['id']: m for m in call('map_tile_models_list', {})}
for m in planned:
    actual = published[m['id']]
    assert actual['assets'] == m['assets'] and actual['maxHeight'] == m['maxHeight']
    if m['category'] != 'creature-base':
        assert actual == m, 'Unrelated miniature metadata changed'
    else:
        assert actual['baseSize'] == m['baseSize'] and actual['category'] == 'creature-base'
receipt = {'verified': True, 'updatedModels': 10, 'newBases': 14,
    'models': [{'modelId': m['id'], 'assets': m['assets']} for m in planned]}
(directory / 'publication.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'verified': True, 'updatedModels': 10, 'newBases': 14}))
