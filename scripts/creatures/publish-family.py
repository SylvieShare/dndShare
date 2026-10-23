#!/usr/bin/env python3
"""Publish the reviewed bundle and verify every requested item/model binding.

Dry-run is local only. --publish uses configured MCP_AUTH_TOKEN; --server-token
may be used only with the user's authorization for the documented server file.
Neither path persists or prints credentials.
"""
import argparse
import hashlib
import json
import os
import shlex
import subprocess
import urllib.request
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('--publish',action='store_true')
parser.add_argument('--server-token',action='store_true')
args=parser.parse_args()
out=args.directory.resolve();root=Path(__file__).resolve().parents[2]
recipes=json.loads(Path(__file__).with_name('kobold-family.json').read_text())
models=json.loads((out/'publish/catalogue.json').read_text())
assert len(models)==len(recipes)==9
targets=[1635]+[i for r in recipes for i in r['itemIds']]
assert len(set(targets))==len(targets)==13
assert {m['id'] for m in models} == {r['modelId'] for r in recipes}
for model in models:
    assert model['hidden'] and model['tileType']=='object'
    assert set(model['assets']) == {'render','lod','shadow','source','preview'}
    for asset in model['assets'].values():
        file=out/'publish'/Path(asset['key']).name
        assert file.stat().st_size == asset['size'], 'Asset size mismatch'
        assert hashlib.sha256(file.read_bytes()).hexdigest() == asset['sha256'], 'Asset SHA-256 mismatch'
if not args.publish:
    print(json.dumps({'dryRun':True,'models':len(models),'itemIds':targets,
        'bytes':sum(a['size'] for m in models for a in m['assets'].values())}))
    raise SystemExit(0)
token=os.environ.get('MCP_AUTH_TOKEN')
if not token and args.server_token:
    remote_code="import pathlib,shlex; lines=pathlib.Path.home().joinpath('dndshare.env').read_text().splitlines(); values=[line.partition('=')[2] for line in lines if line.startswith('MCP_AUTH_TOKEN=')]; assert len(values)==1; print(shlex.split(values[0])[0])"
    remote='python3 -c '+shlex.quote(remote_code)
    token=subprocess.check_output(['ssh','-i',str(Path.home()/'.ssh/dndshare'),
        'sylvieshare@72.56.16.183',remote],text=True).strip()
if not token:
    raise RuntimeError('MCP_AUTH_TOKEN is required; credentials were not searched elsewhere')

def call(name,arguments):
    body=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode()
    req=urllib.request.Request('https://dndshare.ru/mcp',data=body,
        headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
    with urllib.request.urlopen(req,timeout=120) as response:
        data=json.load(response)
    if data.get('error') or data.get('result',{}).get('isError'):
        raise RuntimeError('MCP '+name+' failed')
    return data['result']['structuredContent']['result']

before=call('item_models_list',{'itemId':0})
base_bindings=[b for b in before if b['itemId']==1635]
assert base_bindings, 'Existing kobold binding is required before this publication'
(out/'before-bindings.json').write_text(json.dumps([b for b in before if b['itemId'] in targets],indent=2)+'\n')
env=dict(os.environ,MCP_AUTH_TOKEN=token,GOCACHE='/private/tmp/dndshare-go-cache')
subprocess.run(['go','run','./cmd/map-model-upload','-assets',str(out/'publish'),'-workers','2'],
    cwd=root,env=env,check=True)
for recipe in recipes:
    for item in recipe['itemIds']:
        call('item_model_bind',{'itemId':item,'modelId':recipe['modelId'],'default':True,'sortOrder':0})
        print('Bound',item,'to',recipe['modelId'],flush=True)
bindings=call('item_models_list',{'itemId':0})
for recipe in recipes:
    for item in recipe['itemIds']:
        assert any(b['itemId']==item and b['modelId']==recipe['modelId'] and b['default'] for b in bindings)
assert [b for b in bindings if b['itemId']==1635] == base_bindings,'existing kobold binding changed'
for manifest in models:
    actual=call('map_tile_model_get',{'id':manifest['id']})
    assert actual['assets']==manifest['assets'] and actual['hidden'] and actual['tileType']=='object'
receipt={'verified':True,'newModels':len(models),'itemIds':targets,
    'bindings':[b for b in bindings if b['itemId'] in targets],
    'models':[{'modelId':m['id'],'assets':m['assets']} for m in models]}
(out/'publication.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified':True,'newModels':len(models),'itemIds':targets}))
