#!/usr/bin/env python3
"""Publish the reviewed invocation catalogue through MCP, preserving unrelated data.

Run with MCP_URL and MCP_AUTH_TOKEN in the environment. With no --apply, print
only the planned creates/updates. Existing rows are resolved by English name.
"""
import argparse
import json
import os
from pathlib import Path
import urllib.request


def call(name, arguments):
    request = urllib.request.Request(
        os.environ['MCP_URL'],
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                         'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN'], 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        envelope = json.load(response)
    if 'error' in envelope:
        raise RuntimeError(envelope['error'])
    result = envelope['result']
    if result.get('isError'):
        raise RuntimeError(result)
    if 'result' in result.get('structuredContent', {}):
        return result['structuredContent']['result']
    return json.loads(next(block['text'] for block in result['content'] if block['type'] == 'text'))


def publish(entries, apply):
    types = call('handbook_item_types', {})
    schema = next(item for item in types if item['id'] == 4)
    keys = {field['key'] for field in schema['fields']}
    required = {'ability_selection', 'selection_parent_id', 'selection_requirements', 'spell_modifiers'}
    if not required <= keys:
        raise RuntimeError('Deploy selected-abilities schema before publishing the catalogue')
    parent = call('handbook_items_get', {'ids': [4069]})[0]
    source_ids = parent.get('contentSourceIds', [])
    if not source_ids:
        raise RuntimeError('The granting ability has no handbook source')
    published = []
    for spec in entries:
        matches = call('handbook_items_search', {'typeId': 4, 'q': spec['nameEn'], 'limit': 100})
        exact = [item for item in matches if item.get('nameEn', '').casefold() == spec['nameEn'].casefold()]
        if len(exact) > 1:
            raise RuntimeError('Ambiguous invocation: ' + spec['nameEn'])
        previous = exact[0] if exact else None
        if not apply:
            print(('update' if previous else 'create') + ': ' + spec['name'])
            continue
        arguments = {key: spec[key] for key in ('name', 'nameEn', 'automationStatus', 'automationNote')}
        arguments['data'] = json.dumps({**(previous or {}).get('data', {}), **spec['data']}, ensure_ascii=False)
        if previous:
            arguments['id'] = previous['id']
            item = call('handbook_item_update', arguments)
        else:
            arguments['typeId'] = 4
            item = call('handbook_item_create', arguments)
        call('handbook_item_set_content_sources', {'id': item['id'], 'contentSourceIds': source_ids})
        print(json.dumps({'id': item['id'], 'name': spec['name']}, ensure_ascii=False), flush=True)
        published.append(item['id'])
    if apply:
        data = parent['data']
        data['ability_selection'] = {'replace_count': 1, 'counts': [
            {'level': level, 'count': count} for level, count in [(2,2),(5,3),(7,4),(9,5),(12,6),(15,7),(18,8)]
        ]}
        call('handbook_item_update', {'id': parent['id'], 'name': parent['name'], 'nameEn': parent.get('nameEn', ''),
            'data': json.dumps(data, ensure_ascii=False), 'automationStatus': 'full',
            'automationNote': 'Выбор отдельных воззваний, количество по уровню колдуна, требования и одна замена при повышении уровня. Эффекты оцениваются в карточках конкретных воззваний.'})
        verified = call('handbook_items_get', {'ids': published})
        if len(verified) != len(entries) or any(not item.get('contentSourceIds') or item['data'].get('selection_parent_id') != parent['id'] for item in verified):
            raise RuntimeError('Catalogue verification failed')
        print(f'Verified {len(verified)} invocation entries and their handbook sources', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--catalogue', type=Path, default=Path(__file__).parent / 'catalogue' / 'warlock-invocations')
    args = parser.parse_args()
    entries = [item for path in sorted(args.catalogue.glob('*.json')) for item in json.loads(path.read_text())]
    if len(entries) != 32 or len({item['nameEn'] for item in entries}) != len(entries):
        raise RuntimeError('Expected 32 unique reviewed invocations')
    publish(entries, args.apply)
