#!/usr/bin/env python3
"""Update only Infernal Legacy's action prose and theses through the handbook MCP.

Requires MCP_URL and MCP_AUTH_TOKEN. Preview by default; --apply publishes.
The requested action damage is 2d10; the PHB 2014 racial upcast is 3d10.
"""
import argparse
import json
import os
import urllib.parse
import urllib.request


def call(name, arguments):
    request = urllib.request.Request(os.environ['MCP_URL'],
        data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                         'params': {'name': name, 'arguments': arguments}}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['MCP_AUTH_TOKEN'],
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=40) as response:
        envelope = json.load(response)
    if 'error' in envelope or envelope['result'].get('isError'):
        raise RuntimeError(envelope)
    return envelope['result']['structuredContent']['result']


def update(apply):
    item = call('handbook_items_get', {'ids': [1443]})[0]
    assert item['name'] == 'Дьявольское наследие' and item['typeId'] == 3
    data = item['data']
    actions = [row for row in data['feature_actions'] if row['key'] == 'hellish_rebuke']
    assert len(actions) == 1
    action = actions[0]
    payload = urllib.parse.quote(json.dumps({'formula': '2d10{огонь}', 'label': 'Урон огнём'},
        ensure_ascii=False, separators=(',', ':')), safe='')
    dice = f'<span data-rich-node="dice" data-rich-payload="{payload}" contenteditable="false">2к10</span>'
    action['description'] = ('<p>Наложите «Адское возмездие» без траты ячейки. '
        'Цель совершает спасбросок Ловкости: при провале получает '
        f'{dice} урона огнём, при успехе — половину.</p>')
    dc = 'Сл спасброска = 8 + бонус мастерства + модификатор Харизмы.'
    action['requirements'] = [line for line in action.get('requirements', [])
        if not line.startswith('Сл спасброска')] + [dc]
    print(json.dumps(action, ensure_ascii=False, indent=2))
    if not apply:
        return
    call('handbook_item_update', {'id': item['id'], 'name': item['name'],
        'nameEn': item.get('nameEn', ''), 'data': json.dumps(data, ensure_ascii=False)})
    verified = call('handbook_items_get', {'ids': [item['id']]})[0]
    assert verified['data'] == data, 'Handbook read-back differs from the submitted data'
    print('Verified: Infernal Legacy action updated; other ability fields preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    update(parser.parse_args().apply)
