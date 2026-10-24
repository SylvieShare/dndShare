#!/usr/bin/env python3
"""Publish one verified miniature via MCP; credentials remain in process memory.

Dry-run is local. --server-token uses only the previously authorized
MCP_AUTH_TOKEN from ~/dndshare.env on the project server.
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
parser.add_argument('recipe', type=Path)
parser.add_argument('--publish', action='store_true')
parser.add_argument('--server-token', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
folder = args.directory.resolve()
recipe = json.loads(args.recipe.read_text())
models = json.loads((folder/'publish/catalogue.json').read_text())
verification = json.loads((folder/'verification.json').read_text())
assert verification['passed'] and len(models) == 1
model = models[0]
assert model['id'] == recipe['modelId'] and model['hidden'] and model['tileType'] == 'object'
assert set(model['assets']) == {'render', 'lod', 'shadow', 'source', 'preview'}
for asset in model['assets'].values():
    data = (folder/'publish'/Path(asset['key']).name).read_bytes()
    assert len(data) == asset['size'] and hashlib.sha256(data).hexdigest() == asset['sha256']
if not args.publish:
    print(json.dumps({'dryRun': True, 'itemId': recipe['itemId'], 'modelId': model['id'],
        'bytes': sum(a['size'] for a in model['assets'].values())}))
    raise SystemExit(0)
token = os.environ.get('MCP_AUTH_TOKEN')
if not token and args.server_token:
    code = "import pathlib,shlex; values=[line.partition('=')[2] for line in pathlib.Path.home().joinpath('dndshare.env').read_text().splitlines() if line.startswith('MCP_AUTH_TOKEN=')]; assert len(values)==1; print(shlex.split(values[0])[0])"
    token = subprocess.check_output(['ssh', '-i', str(Path.home()/'.ssh/dndshare'),
        'sylvieshare@72.56.16.183', 'python3 -c '+shlex.quote(code)], text=True).strip()
if not token:
    raise RuntimeError('Configured MCP_AUTH_TOKEN is required')

def call(name, arguments):
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
        'params': {'name': name, 'arguments': arguments}}).encode()
    request = urllib.request.Request('https://dndshare.ru/mcp', data=payload,
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer '+token})
    with urllib.request.urlopen(request, timeout=120) as response:
        value = json.load(response)
    if value.get('error') or value.get('result', {}).get('isError'):
        raise RuntimeError('MCP operation failed: '+name)
    return value['result']['structuredContent']['result']

before = call('item_models_list', {'itemId': recipe['itemId']})
assert all(b['modelId'] == model['id'] for b in before), 'Refusing to replace a different model binding'
(folder/'before-bindings.json').write_text(json.dumps(before, indent=2)+'\n')
subprocess.run(['go', 'run', './cmd/map-model-upload', '-assets', str(folder/'publish'),
    '-workers', '2', '-item-id', str(recipe['itemId'])], cwd=root,
    env=dict(os.environ, MCP_AUTH_TOKEN=token, GOCACHE='/private/tmp/dndshare-go-cache'), check=True)
actual = call('map_tile_model_get', {'id': model['id']})
bindings = call('item_models_list', {'itemId': recipe['itemId']})
assert actual['assets'] == model['assets'] and actual['maxHeight'] == model['maxHeight']
assert any(b['modelId'] == model['id'] and b['default'] for b in bindings)
receipt = {'verified': True, 'itemId': recipe['itemId'], 'modelId': model['id'],
    'originalServiceMeshExported': verification['originalServiceMeshExported'],
    'assets': actual['assets'], 'bindings': bindings}
(folder/'publication.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({'verified': True, 'itemId': recipe['itemId'], 'modelId': model['id']}))
