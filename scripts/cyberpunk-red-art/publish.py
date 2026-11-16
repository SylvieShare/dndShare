"""Publish a visually reviewed RED art batch through the project's system-media MCP."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/creatures'))
from miniature_mcp import MiniatureMCP, configured_token


def get(route):
    with urllib.request.urlopen('https://dndshare.ru/api' + route, timeout=90) as response:
        return json.load(response)


def current_target(asset, source_id):
    target = asset['target']
    if target['kind'] == 'item_type':
        rows = get(f'/item-types?sourceId={source_id}')['types']
        row = next(r for r in rows if r['id'] == target['typeId'])
    elif target['kind'] == 'suggest_type':
        rows = get(f'/suggest/types?sourceId={source_id}')['items']
        row = next(r for r in rows if r['id'] == target['typeId'])
    elif target['kind'] == 'item':
        row = get('/items/by-ids?ids=' + str(target['id']))['items'][0]
        allowed = {r['id'] for r in get(f'/item-types?sourceId={source_id}')['types']}
        if row['typeId'] not in allowed or row.get('userId'):
            raise ValueError('Target is not a base RED record')
    elif target['kind'] == 'suggest':
        allowed = {r['id'] for r in get(f'/suggest/types?sourceId={source_id}')['items']}
        if target['typeId'] not in allowed:
            raise ValueError('Dictionary belongs to another system')
        row = next(r for r in get(f"/suggest/{target['typeId']}")['items'] if r['id'] == target['id'])
        if row.get('userId'):
            raise ValueError('Target is not a base dictionary value')
    else:
        raise ValueError('This target needs dictionary media support before publication')
    if row.get('name', row.get('value')) != target['name']:
        raise ValueError('Target identity changed')
    return row


def request_for(asset, payload):
    target = asset['target']
    args = {'fileName': Path(asset['final']).name, 'mimeType': asset['mimeType'],
            'dataBase64': base64.b64encode(payload).decode(), 'preservePrevious': True}
    if target['kind'] == 'item_type':
        return 'handbook_item_type_set_system_image', dict(args, typeId=target['typeId'], slot=asset['slot'])
    if target['kind'] == 'item':
        return 'handbook_item_set_system_image', dict(args, itemId=target['id'], slot=asset['slot'])
    if target['kind'] == 'suggest_type':
        return 'handbook_suggest_type_set_system_image', dict(args, typeId=target['typeId'], slot=asset['slot'])
    if target['kind'] == 'suggest' and asset['slot'] in ('icon', 'cover'):
        return 'handbook_suggest_set_system_image', dict(args, typeId=target['typeId'], id=target['id'], slot=asset['slot'])
    raise ValueError('Unsupported media slot')


def publish(manifest, apply=False):
    batch = json.loads(manifest.read_text(encoding='utf-8'))
    client = MiniatureMCP(configured_token(True)) if apply else None
    for asset in batch['assets']:
        if not asset.get('visualReview', {}).get('passed'):
            raise ValueError('Visual review required: ' + asset['key'])
        payload = (Path(batch['assetRoot']) / asset['final']).read_bytes()
        if hashlib.sha256(payload).hexdigest() != asset['sha256']:
            raise ValueError('Reviewed file changed: ' + asset['key'])
        row = current_target(asset, batch['sourceId'])
        id_key = asset['slot'] + 'ImageId'
        expected = asset.get('receipt', {}).get('imageId', asset.get('expectedPreviousImageId'))
        if row.get(id_key) != expected:
            raise ValueError('Media slot changed since audit: ' + asset['key'])
        tool, args = request_for(asset, payload)
        if not apply:
            print(asset['key'], tool, len(payload), 'bytes', 'preview')
            continue
        if asset.get('status') != 'published':
            receipt = client.call(tool, args)
            asset['receipt'] = {k: receipt[k] for k in ('imageId', 'objectKey', 'fileSize') if k in receipt}
            asset['status'] = 'uploaded'
            manifest.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        row = current_target(asset, batch['sourceId'])
        if row.get(id_key) != asset['receipt']['imageId']:
            raise RuntimeError('MCP read-back mismatch')
        url = row[asset['slot'] + 'ImageUrl']
        with urllib.request.urlopen(url, timeout=90) as response:
            downloaded = response.read()
        if hashlib.sha256(downloaded).hexdigest() != asset['sha256']:
            raise RuntimeError('Public bytes differ from reviewed artifact')
        asset.update(status='published', url=url)
        asset['visualReview']['publicBytesVerified'] = True
        manifest.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(asset['key'], 'published', asset['receipt']['imageId'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--apply', action='store_true')
    options = parser.parse_args()
    publish(options.manifest, options.apply)
