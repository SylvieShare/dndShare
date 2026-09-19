#!/usr/bin/env python3
"""Prepare/apply reviewed creation recipes, through MCP with conflict checks."""
import argparse, json, os, urllib.request
from pathlib import Path
META = ['automationStatus', 'automationNote', 'requiresPlayerInteraction']
ITEMS = {
 'berry': {'name':'Чудо-ягода', 'spell':691, 'data':{'desc':'<p>Магическая ягода. Действием существо может съесть одну: восстановить 1 хит и насытиться на день. Через 24 игровых часа после создания ягода теряет магические свойства.</p>', 'consumable':True, 'usable':{'healing':'1','note':'Съеденная ягода насыщает существо на день.'}}},
 'elixir': {'name':'Созданный лечебный эликсир', 'spell':602, 'data':{'desc':'<p>Эликсир создаётся заклинанием и сохраняет силу 24 игровых часа. Действием его можно выпить или дать другому существу: оно восстанавливает 2к4 + 2 хита. После употребления флакон исчезает.</p>','consumable':True,'usable':{'healing':'2d4 + 2'}}},
 'food': {'name':'Созданная пища (порция)', 'spell':980, 'data':{'desc':'<p>Одна из пятнадцати порций пищи, создаваемых заклинанием. Вся пища весит 45 фунтов и питает пятнадцать гуманоидов либо пятерых скакунов в течение суток. Не съеденная за 24 игровых часа пища портится.</p>','weight':3,'consumable':True,'usable':{'note':'Расходована одна из 15 порций созданной пищи. Учтите питание существа.'}}},
 'water': {'name':'Созданная вода (галлон)', 'spell':677, 'sources':[677,980], 'data':{'desc':'<p>Один галлон чистой воды, созданной заклинанием. Вода не портится. Контейнер не создаётся вместе с водой.</p>','consumable':True,'usable':{'note':'Израсходован один галлон воды.'}}},
}
for key, item in ITEMS.items(): item['data']['creation_sources']=[{'item':id} for id in item.get('sources',[item['spell']])]
def output(key,count,duration=None,per_slot=0):
 r={'item':{'createdRef':key},'count':count}
 if duration:r['duration']=duration
 if per_slot:r['per_slot']=per_slot
 return r
HOURS24={'kind':'hours','value':24}
RULES={
 691:{'item_creation':[{'key':'berries','title':'Чудо-ягоды','choose_count':True,'outputs':[output('berry',10,HOURS24)]}]},
 602:{'time':{'kind':'minutes','value':1},'item_creation':[{'key':'elixir','title':'Лечебный эликсир','outputs':[output('elixir',1,HOURS24)]}]},
 980:{'item_creation':[{'key':'food_water','title':'Пища и вода','outputs':[output('food',15,HOURS24),output('water',30,{'kind':'permanent'})]}]},
 677:{'item_creation':[{'key':'water','title':'Сотворить воду','choose_count':True,'condition':'В пределах дистанции есть открытый контейнер для создаваемой воды.','outputs':[output('water',10,{'kind':'permanent'},10)]}]},
}
NOTES={691:'Создание до 10 переносимых ягод, расход ячейки, применение одной ягоды к себе или другой цели, лечение и возврат резерва. Окончание 24 игровых часов отмечается на экземпляре.',602:'Создание эликсира за 1 минуту, расход ячейки, применение 2к4 + 2 лечения позднее и расход предмета. Окончание 24 игровых часов отмечается на экземпляре.',980:'Создание 15 порций пищи и 30 галлонов воды одним сотворением, перенос и расход отдельных единиц. Порча пищи через 24 игровых часа отмечается на экземпляре.',677:'Создание воды в контейнере с выбором количества и ростом от ячейки. Уничтожение воды, дождь и рассеивание тумана разрешаются вручную.'}
def call(name,arguments):
 request=urllib.request.Request(os.environ.get('MCP_URL','http://127.0.0.1:8080/mcp'),data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+os.environ['MCP_AUTH_TOKEN']})
 result=json.load(urllib.request.urlopen(request,timeout=90))
 if 'error' in result or result['result'].get('isError'):raise RuntimeError(result)
 return result['result']['structuredContent']['result']
def rows(value):return value if isinstance(value,list) else value['items']
def catalogue(kind):
 found=[]
 while True:
  page=rows(call('handbook_items',{'typeId':kind,'limit':500,'offset':len(found)}));found+=page
  if len(page)<500:return found

def get(id):return next(x for x in rows(call('handbook_items_get',{'ids':[id]})) if x['id']==id)
def main():
 p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--snapshot');p.add_argument('--apply',action='store_true');a=p.parse_args();root=Path(a.directory);root.mkdir(parents=True,exist_ok=True)
 if a.snapshot:
  allrows={r['id']:r for r in json.loads(Path(a.snapshot).read_text())}
  plan=[]
  for id,changes in RULES.items():
   item=allrows[id];plan.append({'id':id,'before':{k:item['data'].get(k) for k in changes},'after':changes,'metadataBefore':{k:item.get(k) for k in META},'metadataAfter':{'automationStatus':'partial' if id==677 else 'full','automationNote':NOTES[id],'requiresPlayerInteraction':False}})
  (root/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');(root/'items.json').write_text(json.dumps(ITEMS,ensure_ascii=False,indent=2)+'\n');print('Prepared',len(plan),'spells');return
 plan=json.loads((root/'plan.json').read_text());specs=json.loads((root/'items.json').read_text());spells={x['id']:x for x in catalogue(5)};gear=catalogue(2);resolved={};existing={}
 for key,spec in specs.items():
  matches=[x for x in gear if x['name']==spec['name'] and not x.get('userId')]
  if len(matches)>1:raise RuntimeError('Duplicate created item: '+key)
  if matches:
   item=matches[0]
   if item['data']!=spec['data']:raise RuntimeError('Changed created item: '+key)
   resolved[key]=item['id'];existing[key]=item
 def resolve(value):
  if isinstance(value,list):return [resolve(v) for v in value]
  if not isinstance(value,dict):return value
  if set(value)=={'createdRef'}:return resolved.get(value['createdRef'],-1)
  return {k:resolve(v) for k,v in value.items()}
 def check(item,spec):
  if item.get('userId') or item['typeId']!=5:raise RuntimeError('Not a system spell')
  for k,v in spec['after'].items():
   if item['data'].get(k) not in [spec['before'][k],resolve(v)]:raise RuntimeError(f'Conflict {item["id"]}: {k}')
  for k in META:
   if item.get(k) not in [spec['metadataBefore'][k],spec['metadataAfter'][k]]:raise RuntimeError(f'Metadata conflict {item["id"]}: {k}')
 for spec in plan:check(spells[spec['id']],spec)
 print(json.dumps({'preflight':'ok','spells':len(plan),'items':len(specs),'apply':a.apply}),flush=True)
 if not a.apply:return
 backup=root/'before.json'
 if not backup.exists():backup.write_text(json.dumps({'spells':list(spells.values()),'items':gear},ensure_ascii=False,indent=2)+'\n')
 for key,spec in specs.items():
  if key not in existing:
   compatibility=[{'sourceVersionId':c['sourceVersionId'],'status':'native'} for c in spells[spec['spell']].get('compatibility',[]) if c['status']=='native']
   if not compatibility:raise RuntimeError('Source spell has no reviewed native edition: '+str(spec['spell']))
   result=call('handbook_item_create',{'typeId':2,'name':spec['name'],'nameEn':'','data':json.dumps(spec['data'],ensure_ascii=False),'automationStatus':'full','automationNote':'Создаётся заклинанием; расход и заданное применение поддержаны. Игровой срок отмечается владельцем.','requiresPlayerInteraction':False,'compatibility':compatibility})
   item=get(result['id'] if isinstance(result,dict) else result)
   if item['data']!=spec['data']:raise RuntimeError('Created item readback mismatch')
   resolved[key]=item['id'];existing[key]=item
  id=resolved[key];source=spells[spec['spell']]
  call('handbook_item_reuse_icon',{'itemId':id,'sourceItemId':source['id']})
  sourceids=sorted({sid for spellid in spec.get('sources',[spec['spell']]) for sid in spells[spellid].get('contentSourceIds',[])})
  call('handbook_item_set_content_sources',{'id':id,'contentSourceIds':sourceids})
  actual=get(id)
  if any(actual.get(k)!=source.get(k) for k in ['iconImageId','iconSvgId']):raise RuntimeError('Icon mismatch')
  print(json.dumps({'item':key,'id':id},ensure_ascii=False),flush=True)
 for spec in plan:
  item=get(spec['id']);check(item,spec);data={**item['data'],**resolve(spec['after'])}
  call('handbook_item_update',{'id':item['id'],'name':item['name'],'nameEn':item.get('nameEn') or '', 'data':json.dumps(data,ensure_ascii=False),**spec['metadataAfter']})
  actual=get(item['id'])
  if actual['data']!=data or any(actual.get(k)!=v for k,v in spec['metadataAfter'].items()):raise RuntimeError('Spell readback mismatch')
  print(json.dumps({'spell':item['id'],'name':item['name']},ensure_ascii=False),flush=True)
 for kind in [2,5]:(root/f'after-{kind}.json').write_text(json.dumps(catalogue(kind),ensure_ascii=False,indent=2)+'\n')
 (root/'applied.json').write_text(json.dumps({'items':resolved,'spells':[s['id'] for s in plan]},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
