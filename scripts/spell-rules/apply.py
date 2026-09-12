#!/usr/bin/env python3
"""Apply a reviewed correction-plan.json through MCP, with conflict checks.

MCP_AUTH_TOKEN and MCP_URL must be provided by the environment. Dry run by
 default; --apply performs the reviewed updates. Every write is read back.
"""
import argparse, json, os, urllib.request
p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('--apply',action='store_true');args=p.parse_args()
plan=json.load(open(args.plan));url=os.environ.get('MCP_URL','http://127.0.0.1:8080/mcp')
def call(name,arguments):
    request=urllib.request.Request(url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ['MCP_AUTH_TOKEN']})
    result=json.load(urllib.request.urlopen(request,timeout=60))
    if 'error'in result or result['result'].get('isError'):raise RuntimeError(result)
    return result['result']['structuredContent']['result']
def get(id):
    result=call('handbook_items_get',{'ids':[id]})
    rows=result if isinstance(result,list)else result['items']
    return next(row for row in rows if row['id']==id)
changed=0;already=0
for change in plan:
    item=get(change['id']);data=item['data'];pending={}
    for key,patch in change['changes'].items():
        current=data.get(key)
        if current==patch['after']:continue
        if current!=patch['before']:raise RuntimeError(f"Concurrent change: {item['id']} {key}; no overwrite")
        pending[key]=patch['after']
    if not pending:already+=1;continue
    if args.apply:
        data.update(pending)
        call('handbook_item_update',{'id':item['id'],'name':item['name'],'nameEn':item.get('nameEn',''),'data':json.dumps(data,ensure_ascii=False)})
        verified=get(item['id'])['data']
        if any(verified.get(key)!=value for key,value in pending.items()):raise RuntimeError(f"Readback differs: {item['id']}")
    changed+=1
    print(json.dumps({'id':item['id'],'name':item['name'],'fields':list(pending),'applied':args.apply},ensure_ascii=False),flush=True)
print(json.dumps({'changed':changed,'alreadyApplied':already,'applied':args.apply}),flush=True)
