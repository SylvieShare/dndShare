#!/usr/bin/env python3
"""Apply reviewed standing diameters without uploading or changing model assets.

Default: offline validation of PLAN. --snapshot reads current MCP metadata into
OUTPUT/before-models.json. --apply uses that snapshot, refuses concurrent edits,
and changes only referenceDiameter. Tokens remain in memory. --server-token
uses the project's specifically authorized ~/dndshare.env file on its VM.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import urllib.request


def planned_model(model, entry):
    if model['id'] != entry['modelId'] or model['sourceCode'] != entry['sourceCode']:
        raise ValueError('Calibration identity differs from reviewed model')
    if model['tileType'] != 'object':
        raise ValueError('Calibration requires object geometry')
    return dict(model, referenceDiameter=entry['referenceDiameter'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('output', type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--snapshot', action='store_true')
    mode.add_argument('--apply', action='store_true')
    parser.add_argument('--server-token', action='store_true')
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text())
    assert plan and len({e['modelId'] for e in plan}) == len(plan)
    assert all(0 < e['referenceDiameter'] <= 32 for e in plan)
    if not (args.snapshot or args.apply):
        print(json.dumps({'dryRun': True, 'models': len(plan)}))
        return
    token = os.environ.get('MCP_AUTH_TOKEN')
    if not token and args.server_token:
        code = "import pathlib,shlex; v=[l.partition('=')[2] for l in pathlib.Path.home().joinpath('dndshare.env').read_text().splitlines() if l.startswith('MCP_AUTH_TOKEN=')]; assert len(v)==1; print(shlex.split(v[0])[0])"
        token = subprocess.check_output(['ssh', '-i', str(Path.home()/'.ssh/dndshare'),
            'sylvieshare@72.56.16.183', 'python3 -c '+shlex.quote(code)], text=True).strip()
    if not token:
        raise RuntimeError('Configured MCP_AUTH_TOKEN required')

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

    args.output.mkdir(parents=True, exist_ok=True)
    snapshot = args.output/'before-models.json'
    current = [call('map_tile_model_get', {'id': e['modelId']}) for e in plan]
    if args.snapshot:
        if snapshot.exists():
            raise RuntimeError('Snapshot already exists; choose a new output folder')
        for model, entry in zip(current, plan):
            planned_model(model, entry)
        snapshot.write_text(json.dumps(current, ensure_ascii=False, indent=2)+'\n')
        bindings = call('item_models_list', {'itemId': 0})
        (args.output/'before-bindings.json').write_text(json.dumps(bindings, indent=2)+'\n')
        print(json.dumps({'snapshot': True, 'models': len(current)}))
        return
    before = json.loads(snapshot.read_text())
    assert len(before) == len(plan)
    planned = [planned_model(m, e) for m, e in zip(before, plan)]
    # Preflight the entire batch before changing the first model. Idempotent retry
    # accepts only the exact before/after documents, never a third-party edit.
    assert all(now in (old, new) for now, old, new in zip(current, before, planned)), 'Model changed after snapshot'
    bindings = json.loads((args.output/'before-bindings.json').read_text())
    assert call('item_models_list', {'itemId': 0}) == bindings, 'Bindings changed after snapshot'
    for now, model in zip(current, planned):
        if now != model:
            # Recheck immediately before each write; the registry keeps assets.
            assert call('map_tile_model_get', {'id': model['id']}) == now, 'Concurrent model change'
            actual = call('map_tile_model_register', {'model': model})
            assert actual == model, 'Registry did not preserve model metadata'
    actual = [call('map_tile_model_get', {'id': m['id']}) for m in planned]
    assert actual == planned
    assert call('item_models_list', {'itemId': 0}) == bindings
    (args.output/'publication.json').write_text(json.dumps({'verified': True,
        'models': actual, 'bindings': bindings}, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'verified': True, 'models': len(actual), 'assetsChanged': False}))


if __name__ == '__main__':
    main()
