#!/usr/bin/env python3
"""Publish reviewed effect follow-ups via MCP. Default: read-only preview."""
import argparse
import json
import os
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
base = json.loads(Path(__file__).with_name('plan.json').read_text())
plan = json.loads(Path(__file__).with_name('followups.json').read_text())

def call(name, arguments):
    request = urllib.request.Request(os.environ.get('MCP_URL', 'http://127.0.0.1:8080/mcp'), data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN']})
    response = json.load(urllib.request.urlopen(request, timeout=60))
    if response.get('error') or response.get('result', {}).get('isError'):
        raise RuntimeError('MCP failed: ' + name)
    return response['result']['structuredContent']['result']

def rows(result):
    return result if isinstance(result, list) else result['items']

def get(item_id):
    return rows(call('handbook_items_get', {'ids': [item_id]}))[0]

call('handbook_item_types', {})
effects = {item['data'].get('code'): item for item in rows(call('handbook_items', {'typeId': 15, 'limit': 500}))}
for code, definition in plan['newEffects'].items():
    item = effects.get(code)
    if item and item['data'] != definition['data']:
        raise RuntimeError('Conflicting existing effect: ' + code)
    if not item and args.apply:
        item = call('handbook_item_create', {'typeId': 15, 'name': definition['name'], 'data': json.dumps(definition['data'], ensure_ascii=False), 'automationStatus': 'partial', 'automationNote': definition['note']})
        if get(item['id'])['data'] != definition['data']:
            raise RuntimeError('Effect readback differs: ' + code)
    effects[code] = item or {'id': -1}

def resolve(value):
    if isinstance(value, list): return [resolve(v) for v in value]
    if not isinstance(value, dict): return value
    if set(value) == {'ref'}: return {'id': effects[value['ref']]['id']}
    return {k: resolve(v) for k, v in value.items()}

for patch in plan['patches']:
    item = get(patch.get('id') or effects[patch['code']]['id'])
    previous = base['effects'][patch['code']]['data'] if patch.get('code') in base['effects'] else next((row for row in base['potions'] + base['spells'] if row['id'] == item['id']), {})
    changed = resolve(patch['data'])
    for key, value in changed.items():
        if item['data'].get(key) not in (resolve(previous.get(key)), value):
            raise RuntimeError(f"Concurrent change: {item['id']} {key}")
    data = {**item['data'], **changed}
    if args.apply:
        call('handbook_item_update', {'id': item['id'], 'name': item['name'], 'nameEn': item.get('nameEn', ''), 'data': json.dumps(data, ensure_ascii=False), 'automationStatus': 'partial', 'automationNote': patch['note']})
        if get(item['id'])['data'] != data: raise RuntimeError('Readback differs: ' + str(item['id']))
    print(json.dumps({'id': item['id'], 'name': item['name'], 'applied': args.apply}, ensure_ascii=False), flush=True)
print(json.dumps({'newEffects': len(plan['newEffects']), 'patches': len(plan['patches']), 'applied': args.apply}))
