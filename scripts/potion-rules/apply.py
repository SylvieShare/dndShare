#!/usr/bin/env python3
"""Publish the reviewed potion/spell plan through MCP; preserve unrelated data.

Run on the VM with MCP_AUTH_TOKEN in the environment. No secrets are printed.
Without --apply the command reads catalogue types and reports planned changes.
Every mutation is read back. Interrupted runs reuse effects by their exact code.
"""
import argparse
import json
import os
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
plan = json.loads(Path(__file__).with_name('plan.json').read_text())

def call(name, arguments):
    request = urllib.request.Request(os.environ.get('MCP_URL', 'http://127.0.0.1:8080/mcp'),
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN']})
    response = json.load(urllib.request.urlopen(request, timeout=60))
    if response.get('error') or response.get('result', {}).get('isError'):
        raise RuntimeError('MCP operation failed: ' + name)
    return response['result']['structuredContent']['result']

def rows(result):
    return result if isinstance(result, list) else result['items']

def get(item_id):
    return rows(call('handbook_items_get', {'ids': [item_id]}))[0]

call('handbook_item_types', {})
existing = rows(call('handbook_items', {'typeId': 15, 'limit': 500}))
by_code = {item['data'].get('code'): item for item in existing}
resolved = {}
for code, definition in plan['effects'].items():
    item = by_code.get(code)
    if item and item['data'] != definition['data']:
        raise RuntimeError('Existing effect differs from reviewed plan: ' + code)
    if not item and args.apply:
        item = call('handbook_item_create', {'typeId': 15, 'name': definition['name'], 'nameEn': '', 'data': json.dumps(definition['data'], ensure_ascii=False), 'automationStatus': 'partial', 'automationNote': 'Эффект на листе; особые условия и окончание действия отмечаются вручную.'})
        if get(item['id'])['data'] != definition['data']:
            raise RuntimeError('Effect readback differs: ' + code)
    resolved[code] = item['id'] if item else -1


def resolve(value):
    if isinstance(value, list):
        return [resolve(v) for v in value]
    if not isinstance(value, dict):
        return value
    if set(value) == {'ref'}:
        return {'id': resolved[value['ref']]}
    return {k: resolve(v) for k, v in value.items()}

for group in ['spells', 'potions']:
    for patch in plan[group]:
        item = get(patch['id'])
        changed = resolve({k: v for k, v in patch.items() if k in ['usable', 'status_effects']})
        for key, value in changed.items():
            if item['data'].get(key) not in (None, [], value):
                raise RuntimeError(f"Concurrent catalogue change: {item['id']} {key}")
        data = {**item['data'], **changed}
        if args.apply:
            call('handbook_item_update', {'id': item['id'], 'name': item['name'], 'nameEn': item.get('nameEn', ''), 'data': json.dumps(data, ensure_ascii=False),
                'automationStatus': patch.get('automationStatus', 'partial'),
                'automationNote': patch.get('automationNote', 'Связанный эффект добавляется на лист. Выбор целей, спасброски и окончание действия отмечаются вручную.')})
            if get(item['id'])['data'] != data:
                raise RuntimeError('Item readback differs: ' + str(item['id']))
        print(json.dumps({'id': item['id'], 'name': item['name'], 'applied': args.apply}, ensure_ascii=False), flush=True)
print(json.dumps({'effects': len(resolved), 'spells': len(plan['spells']), 'potions': len(plan['potions']), 'applied': args.apply}))
