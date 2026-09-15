#!/usr/bin/env python3
"""Apply a reviewed plan over MCP; compare before values and read every write back."""
import argparse,json,os,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--apply',action='store_true');args=p.parse_args()
root=Path(args.directory);plan=json.loads((root/'plan.json').read_text());effects=json.loads((root/'effects.json').read_text())
url=os.environ.get('MCP_URL','http://127.0.0.1:8080/mcp')
def call(name,arguments):
 request=urllib.request.Request(url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ['MCP_AUTH_TOKEN']})
 result=json.load(urllib.request.urlopen(request,timeout=90))
 if 'error'in result or result['result'].get('isError'):raise RuntimeError(result)
 return result['result']['structuredContent']['result']
def rows(value):return value if isinstance(value,list)else value['items']
def get(id):return next(x for x in rows(call('handbook_items_get',{'ids':[id]})) if x['id']==id)
def update(item,data,metadata):
 if item.get('userId') is not None:raise RuntimeError('Not a system item')
 call('handbook_item_update',{'id':item['id'],'name':item['name'],'nameEn':item.get('nameEn') or '', 'data':json.dumps(data,ensure_ascii=False),**metadata})
 verified=get(item['id'])
 if verified['data']!=data or any(verified.get(key)!=value for key,value in metadata.items()):raise RuntimeError(f"Readback mismatch {item['id']}")
 return verified
catalogue=rows(call('handbook_items',{'typeId':15,'limit':500}))
bycode={item['data'].get('code'):item for item in catalogue}
byspell={item['id']:item for item in plan}
links={};created=[]
for effect in effects:
 key=effect['key'];existing=bycode.get(key);spec=byspell[effect['spellId']]
 metadata={k:spec[k] for k in ['automationStatus','automationNote']};metadata['requiresPlayerInteraction']=False
 if args.apply:
  if not existing:
   result=call('handbook_item_create',{'typeId':15,'name':effect['name'],'nameEn':effect['nameEn'] or '', 'data':json.dumps(effect['data'],ensure_ascii=False),**metadata})
   id=result['id'] if isinstance(result,dict)else result
   existing=get(id);created.append(id)
  elif existing['data']!=effect['data']:existing=update(existing,effect['data'],metadata)
  source=get(effect['spellId'])
  if source.get('iconImageId') or source.get('iconSvgId'):
   call('handbook_item_reuse_icon',{'itemId':existing['id'],'sourceItemId':source['id']})
   actual=get(existing['id'])
   if any(actual.get(k)!=source.get(k) for k in ['iconImageId','iconSvgId']):raise RuntimeError('Icon ID differs')
  link={'key':key,'effect':{'id':existing['id']},'duration':effect['duration'],'concentration':effect['data'].get('concentration',False)}
  if effect['condition']:link['condition']=effect['condition']
  for field in ['parameter_bindings','duration_levels']:
   if effect.get(field):link[field]=effect[field]
  links.setdefault(effect['spellId'],[]).append(link)
 print(json.dumps({'effect':key,'id':existing['id'] if existing else None,'apply':args.apply},ensure_ascii=False),flush=True)
changed=[]
for spec in plan:
 item=get(spec['id']);data=item['data'];pending={}
 for key,patch in spec['changes'].items():
  if data.get(key)==patch['after']:continue
  if data.get(key)!=patch['before']:raise RuntimeError(f"Concurrent data change {item['id']} {key}")
  pending[key]=patch['after']
 for key,value in spec['metadataBefore'].items():
  if item.get(key)!=value and item.get(key)!=spec[key]:raise RuntimeError(f"Concurrent metadata change {item['id']} {key}")
 metadata={k:spec[k] for k in ['automationStatus','automationNote','requiresPlayerInteraction']}
 if links.get(item['id']):
  next_links=list(data.get('status_effects',[]));bykey={row.get('key'):i for i,row in enumerate(next_links)}
  for link in links[item['id']]:
   if link['key'] in bykey:next_links[bykey[link['key']]]=link
   else:next_links.append(link)
  if next_links!=data.get('status_effects'):pending['status_effects']=next_links
 if not pending and all(item.get(k)==v for k,v in metadata.items()):continue
 if args.apply:
  data.update(pending);update(item,data,metadata)
 changed.append(item['id'])
 print(json.dumps({'id':item['id'],'name':item['name'],'fields':list(pending),'status':metadata['automationStatus'],'apply':args.apply},ensure_ascii=False),flush=True)
(root/'applied.json').write_text(json.dumps({'createdEffects':created,'updatedSpells':changed,'effectLinks':links,'applied':args.apply},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'createdEffects':len(created),'updatedSpells':len(changed),'applied':args.apply}),flush=True)
