#!/usr/bin/env python3
"""Explicit MCP data operation: merge lit/unlit torches without changing assets.

Requires MCP_AUTH_TOKEN. Preview by default; --apply prepares the target, previews
the document migration, applies it atomically, then sets the new-placement default.
"""
import argparse
import json
import os
import sys
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()


def call(name, arguments):
    request = urllib.request.Request(
        os.environ.get('MCP_URL', 'https://dndshare.ru/mcp'),
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                         'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN']})
    response = json.load(urllib.request.urlopen(request, timeout=180))
    if response.get('error') or response.get('result', {}).get('isError'):
        raise RuntimeError(name + ': ' + json.dumps(response.get('error') or response['result'], ensure_ascii=False))
    return response['result']['structuredContent']['result']


def behaviour(model):
    return call('map_tile_model_behaviour_get', {'definitionId': model['definitionId']})['behaviour']


def save(model, value):
    return call('map_tile_model_behaviour_update', {'definitionId': model['definitionId'], 'behaviour': value})['behaviour']


models = call('map_tile_models_list', {'collection': 'medieval-town-vol1'})
source = next(m for m in models if m['definitionId'] == 'MT1-016')
target = next(m for m in models if m['definitionId'] == 'MT1-017')
source_b, target_b = behaviour(source), behaviour(target)
before = {'source': source, 'target': target, 'sourceBehaviour': source_b, 'targetBehaviour': target_b}
for field in ['width', 'height', 'mountDepth', 'placementOffset']:
    if source[field] != target[field]:
        raise RuntimeError('Torch frames differ: ' + field)
flag_key, effect_key, light_key = 'torch-burning', 'torch-fire', 'torch-flame'
request = {'sourceId': source['id'], 'targetId': target['id'],
           'expectedSourceLod': source['assets']['lod']['sha256'],
           'expectedTargetLod': target['assets']['lod']['sha256'],
           'flagKey': flag_key, 'lightKey': light_key, 'name': 'Факел', 'apply': False}
if not args.apply:
    print(json.dumps({'before': before, 'merge': request,
                      'stateTransfer': 'source light enabled → flag; existing unlit target stays off'}, ensure_ascii=False, indent=2))
    raise SystemExit(0)
if not isinstance(target_b.get('defaultFlags'), list) or not isinstance(target_b.get('defaultEffects'), list):
    raise RuntimeError('Deploy the flags/effects contract before merging the catalogue')


def union(target_items, source_items):
    result = {item['key']: item.copy() for item in source_items}
    result.update({item['key']: item.copy() for item in target_items})
    return list(result.values())


already_configured = source.get('hidden') and any(f['key'] == flag_key for f in target_b.get('defaultFlags', []))
if not already_configured:
    flags = union(target_b.get('defaultFlags', []), source_b.get('defaultFlags', []))
    flags = [f for f in flags if f['key'] != flag_key] + [{'key': flag_key, 'name': 'Горит', 'enabled': False}]
    lights = union(target_b['defaultLights'], source_b['defaultLights'])
    main = next(l for l in lights if l['key'] == light_key)
    main.update(name='Свет', enabled=True, flagKey=flag_key)
    effects = union(target_b.get('defaultEffects', []), source_b.get('defaultEffects', []))
    if not any(e['key'] == effect_key for e in effects):
        effects.append({'key': effect_key, 'name': 'Пламя', 'kind': 'fire',
                        'color': main['color'], 'size': [0.22, 0.35], 'strength': 0.7,
                        'enabled': True, 'flagKey': flag_key,
                        'position': [0.177571, 0.205571, round(source['maxHeight'] - source['mountDepth'] - 0.35, 6)]})
    else:
        next(e for e in effects if e['key'] == effect_key)['flagKey'] = flag_key
    target_b = save(target, {**target_b, 'defaultFlags': flags, 'defaultEffects': effects, 'defaultLights': lights})

preview = call('map_tile_model_merge', request)
print('TORCH_MERGE_PREVIEW ' + json.dumps(preview), file=sys.stderr)
applied = call('map_tile_model_merge', {**request, 'apply': True})
target_b = behaviour(target)
next(f for f in target_b['defaultFlags'] if f['key'] == flag_key)['enabled'] = True
target_b = save(target, target_b)
source_archive = behaviour(source)
source_archive.update(defaultLights=[], defaultFlags=[], defaultEffects=[], transitions=[])
save(source, source_archive)
verified = call('map_tile_model_merge', request)
if verified['placements'] or verified['maps'] or verified['sessionMaps']:
    raise RuntimeError('Unmigrated documents remain: ' + json.dumps(verified))
source_after = call('map_tile_model_get', {'id': source['id']})
target_after = call('map_tile_model_get', {'id': target['id']})
if not source_after['hidden'] or target_after['name'] != 'Факел':
    raise RuntimeError('Catalogue merge verification failed')
if source_after['assets'] != source['assets'] or target_after['assets'] != target['assets']:
    raise RuntimeError('Merge changed model assets')
print(json.dumps({'before': before, 'preview': preview, 'applied': applied,
                  'verified': verified, 'source': source_after, 'target': target_after,
                  'targetBehaviour': target_b}, ensure_ascii=False, indent=2))
