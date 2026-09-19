#!/usr/bin/env python3
"""Publish a reviewed manifest through MCP: prepare -> apply -> verify.

MCP_AUTH_TOKEN stays in the environment. prepare resolves three shared
dictionaries, records the original definitions, and saves the exact previewed
request. apply never rebuilds the request. All edition records commit atomically.
"""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import urllib.request

DICTIONARIES = [
    (4, 'martial-light', 'Воинское оружие со свойством «Лёгкое»'),
    (4, 'martial-finesse', 'Воинское оружие со свойством «Фехтовальное»'),
    (6, 'common-sign', 'Общий язык жестов'),
]
PRESERVED = ['name', 'nameEn', 'typeId', 'parentId', 'data', 'automationStatus',
             'automationNote', 'requiresPlayerInteraction', 'iconImageId',
             'iconSvgId', 'coverImageId', 'hidden', 'userId']


def call(name, arguments):
    request = urllib.request.Request(
        os.environ.get('MCP_URL', 'http://127.0.0.1:8080/mcp'),
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                         'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN']})
    result = json.load(urllib.request.urlopen(request, timeout=300))
    if 'error' in result or result['result'].get('isError'):
        raise RuntimeError(result)
    return result['result']['structuredContent']['result']


def rows(result, key='items'):
    return result if isinstance(result, list) else result[key]


def fetch_items(ids):
    ids = sorted(set(ids))
    found = {}
    for start in range(0, len(ids), 100):
        for item in rows(call('handbook_items_get', {'ids': ids[start:start + 100]})):
            found[item['id']] = item
    if set(found) != set(ids):
        raise RuntimeError('Missing item IDs: ' + str(set(ids) - set(found)))
    return found


def save(path, value):
    temporary = path.with_suffix('.new')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def definitions(items):
    return {str(id): {key: item.get(key) for key in PRESERVED} for id, item in items.items()}


def prepare(manifest, directory):
    request = json.loads(manifest.read_text())
    sources = rows(call('handbook_sources', {}), 'sources')
    source = next(row for row in sources if row['name'].lower() == 'dnd5e')
    version = next(row['id'] for row in source['versions'] if row['version'] == '2024')
    base = os.environ.get('MCP_URL', 'http://127.0.0.1:8080/mcp').removesuffix('/mcp')
    books = json.load(urllib.request.urlopen(base + '/api/content-sources?sourceVersionId=' + str(version)))['sources']
    book = next(row['id'] for row in books if row['code'] == 'PHB' and row.get('nativeSourceVersionId') == version)
    references = {}
    for type_id, code, name in DICTIONARIES:
        existing = [row for row in rows(call('handbook_suggests', {'typeId': type_id}), 'suggests') if row.get('code') == code]
        if not existing:
            call('handbook_suggest_create', {'typeId': type_id, 'code': code, 'value': name})
            existing = [row for row in rows(call('handbook_suggests', {'typeId': type_id}), 'suggests') if row.get('code') == code]
        if len(existing) != 1 or existing[0]['value'] != name:
            raise RuntimeError('Conflicting dictionary: ' + code)
        references[f'suggest:{type_id}:{code}'] = existing[0]['id']
    request.update(contentSourceId=book, sourceVersionId=version, references=references)
    ids = [r['originalId'] for r in request['records'] if r.get('originalId')]
    ids += request.get('reprints', []) + [row['id'] for row in request.get('decisions', [])]
    before = directory / 'originals.json'
    if not before.exists():
        save(before, definitions(fetch_items(ids)))
    preview = call('handbook_edition_import', request)
    request['previewToken'] = preview['token']
    save(directory / 'request.json', request)
    save(directory / 'preview.json', preview)
    print(json.dumps({key: preview[key] for key in ['created', 'existing', 'decisions', 'applied', 'token']}), flush=True)


def apply(directory):
    request = json.loads((directory / 'request.json').read_text())
    request['apply'] = True
    result = call('handbook_edition_import', request)
    save(directory / 'applied.json', result)
    print(json.dumps({key: result[key] for key in ['created', 'existing', 'decisions', 'applied']}), flush=True)
    verify(directory)


def verify(directory):
    request = json.loads((directory / 'request.json').read_text())
    result = json.loads((directory / 'applied.json').read_text())
    ids = result['ids']

    def resolve(value):
        if isinstance(value, dict):
            if '$ref' in value:
                return ids[value['$ref']]
            return {key: resolve(child) for key, child in value.items()}
        if isinstance(value, list):
            return [resolve(child) for child in value]
        return value

    actual = fetch_items([ids[row['key']] for row in request['records']])
    for record in request['records']:
        item = actual[ids[record['key']]]
        expected = resolve(record['data'])
        expected.pop('edition_key', None)
        expected.pop('import_fingerprint', None)
        data = {key: value for key, value in item['data'].items() if key not in ['edition_key', 'import_fingerprint']}
        # Reverse child arrays are maintained by the origin-relation trigger.
        reverse_key = {8: 'subraces', 9: 'subclasses'}.get(item['typeId'])
        if reverse_key:
            expected_children = sorted(ids[row['key']] for row in request['records'] if row.get('parentKey') == record['key'])
            actual_children = sorted(row['id'] for row in data.pop(reverse_key, []))
            if actual_children != expected_children:
                raise RuntimeError('Reverse relation mismatch: ' + record['key'])
            expected.pop(reverse_key, None)
        if data != expected or item['data'].get('edition_key') != record['key']:
            raise RuntimeError('Content readback mismatch: ' + record['key'])
        if item['name'] != record['name'] or item['typeId'] != record['typeId']:
            raise RuntimeError('Metadata mismatch: ' + record['key'])
        if item.get('automationStatus') != record['automationStatus'] or item.get('automationNote', '') != record.get('automationNote', ''):
            raise RuntimeError('Automation metadata mismatch: ' + record['key'])
        if record.get('parentKey') and item.get('parentId') != ids[record['parentKey']]:
            raise RuntimeError('Parent mismatch: ' + record['key'])
        if not any(c['sourceVersionId'] == request['sourceVersionId'] and c['status'] == 'native' for c in item['compatibility']):
            raise RuntimeError('Compatibility mismatch: ' + record['key'])
        if request['contentSourceId'] not in [row['id'] for row in item['contentSources']]:
            raise RuntimeError('Publication mismatch: ' + record['key'])
    original = json.loads((directory / 'originals.json').read_text())
    after = definitions(fetch_items([int(id) for id in original]))
    if after != original:
        raise RuntimeError('Original definition changed: ' + str([id for id in original if original[id] != after[id]]))
    shared = fetch_items(request.get('reprints', []))
    for item in shared.values():
        if not any(c['sourceVersionId'] == request['sourceVersionId'] and c['status'] in ['native', 'compatible'] for c in item['compatibility']):
            raise RuntimeError('Shared item not selectable: ' + str(item['id']))
    report = {'verified': True, 'records': len(actual), 'shared': len(shared),
              'originalDefinitionsUnchanged': len(original), 'originalDigest': digest(original),
              'requestDigest': digest(request), 'byType': dict(Counter(row['typeId'] for row in request['records'])),
              'automation': dict(Counter(row['automationStatus'] for row in request['records'])),
              'sourceVersionId': request['sourceVersionId'], 'contentSourceId': request['contentSourceId']}
    save(directory / 'verification.json', report)
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'apply', 'verify'])
    parser.add_argument('directory', type=Path)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    if args.action == 'prepare':
        if not args.manifest:
            parser.error('--manifest required for prepare')
        prepare(args.manifest, args.directory)
    elif args.action == 'apply':
        apply(args.directory)
    else:
        verify(args.directory)
