#!/usr/bin/env python3
"""Publish reviewed feat batches through MCP. Preview is the default.

MCP_AUTH_TOKEN is supplied by the caller. A batch is preflighted before writes;
each item is reread before saving, and unrelated fields are retained. Receipts
and the original backup go to an ignored build directory, never into runtime.
"""
import argparse
import copy
import json
import os
from pathlib import Path
import urllib.request

PROTECTED = ('typeId', 'contentSourceIds', 'compatibility', 'derivedFromItemId',
             'derivationKind', 'iconImageId', 'iconSvgId', 'coverImageId', 'hidden')
METADATA = ('name', 'nameEn', 'automationStatus', 'automationNote', 'requiresPlayerInteraction')


def call(name, arguments):
    payload = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
               'params': {'name': name, 'arguments': arguments}}
    request = urllib.request.Request(
        os.environ.get('MCP_URL', 'https://dndshare.ru/mcp'),
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN']})
    with urllib.request.urlopen(request, timeout=90) as response:
        result = json.load(response)
    if result.get('error') or result.get('result', {}).get('isError'):
        raise RuntimeError('MCP operation failed: ' + name)
    return result['result']['structuredContent']['result']


def get_items(ids):
    result = call('handbook_items_get', {'ids': ids})
    return {item['id']: item for item in (result if isinstance(result, list) else result['items'])}


def preflight(item, spec):
    if item.get('userId') or item.get('typeId') != 7 or item.get('deleted'):
        raise ValueError(f"Not a live system feat: {spec['id']}")
    if not any(row['sourceVersionId'] == spec['editionId'] and row['status'] == 'native'
               for row in item.get('compatibility', [])):
        raise ValueError(f"Edition changed: {spec['id']}")
    for section, source in [('fields', item['data']), ('metadata', item)]:
        for key, change in spec.get(section, {}).items():
            if section == 'metadata' and key not in METADATA:
                raise ValueError('Unsupported metadata: ' + key)
            if source.get(key) not in (change['before'], change['after']):
                raise ValueError(f"Concurrent change: {spec['id']} {section}.{key}")


def proposed(item, spec):
    preflight(item, spec)
    result = copy.deepcopy(item)
    for section, target in [('fields', result['data']), ('metadata', result)]:
        for key, change in spec.get(section, {}).items():
            if change['after'] is None:
                target.pop(key, None)
            else:
                target[key] = copy.deepcopy(change['after'])
    return result


def verify(actual, expected):
    for key in ('id', 'data', *METADATA, *PROTECTED):
        if actual.get(key) != expected.get(key):
            raise ValueError(f"Read-back differs: {expected['id']} {key}")


def save(item):
    call('handbook_item_update', {
        'id': item['id'], 'data': json.dumps(item['data'], ensure_ascii=False),
        **{key: item[key] for key in METADATA if key in item},
    })
    actual = get_items([item['id']])[item['id']]
    verify(actual, item)
    return actual


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('batch', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    specs = json.loads(args.batch.read_text(encoding='utf-8'))
    ids = [spec['id'] for spec in specs]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError('Empty batch or duplicate ids')
    items = get_items(ids)
    for spec in specs:
        proposed(items[spec['id']], spec)
    print(json.dumps({'preflight': 'ok', 'items': len(ids), 'apply': args.apply}), flush=True)
    if not args.apply:
        return
    args.output.mkdir(parents=True, exist_ok=True)
    backup = args.output / (args.batch.stem + '-before.json')
    if not backup.exists():
        backup.write_text(json.dumps(list(items.values()), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    receipt = []
    for spec in specs:
        current = get_items([spec['id']])[spec['id']]
        expected = proposed(current, spec)
        changed = expected != current
        actual = save(expected) if changed else current
        verify(actual, expected)
        receipt.append({'id': actual['id'], 'name': actual['name'], 'changed': changed,
                        'changedAt': actual['changedAt'], 'automationStatus': actual['automationStatus']})
        (args.output / (args.batch.stem + '-receipt.json')).write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(receipt[-1], ensure_ascii=False), flush=True)
    actual = get_items(ids)
    for spec in specs:
        verify(actual[spec['id']], proposed(actual[spec['id']], spec))
    print(json.dumps({'verified': len(receipt)}), flush=True)


if __name__ == '__main__':
    main()
