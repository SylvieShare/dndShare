#!/usr/bin/env python3
"""Prepare native 2024 physical outputs. Apply with item_creation.py."""
import json, sys
from pathlib import Path
source=Path(sys.argv[1]);root=Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
spells={x['id']:x for x in json.loads(source.read_text())}
H={'kind':'hours','value':24};P={'kind':'permanent'}
items={
 'berry2024':{'name':'Добряника (ягода)','spell':6134,'data':{'desc':'<p>Бонусным действием можно съесть одну ягоду: восстановить 1 хит и насытиться на день. Несъеденные ягоды исчезают через 24 игровых часа после создания. Срок отмечает владелец стопки.</p>','consumable':True,'usable':{'healing':'1','note':'Ягода съедена бонусным действием и насыщает существо на день.'}}},
 'food2024':{'name':'Созданная пища (фунт)','spell':6403,'data':{'desc':'<p>Один фунт безвкусной, но сытной пищи. При сотворении возникает 45 фунтов. Несъеденная за 24 игровых часа пища портится.</p>','weight':1,'consumable':True,'usable':{'note':'Израсходован один фунт созданной пищи. Учтите питание существа.'}}},
 'water2024':{'name':'Созданная вода (галлон)','spell':6401,'sources':[6401,6403],'data':{'desc':'<p>Галлон чистой воды, созданной заклинанием. Вода не портится. Вместе с ней не создаётся контейнер.</p>','consumable':True,'usable':{'note':'Израсходован один галлон воды.'}}},
}
for key,spec in items.items():spec['data']['creation_sources']=[{'item':id} for id in spec.get('sources',[spec['spell']])]
def out(key,count,duration,**extra):return {'item':{'createdRef':key},'count':count,'duration':duration,**extra}
rules={
 6134:({'item_creation':[{'key':'berries','title':'Добряника','outputs':[out('berry2024',10,H,on_expire='vanish')]}]},'Создание 10 ягод, расход ячейки, лечение одной ягодой через общий usable и насыщение на день. По окончании 24 игровых часов владелец отмечает исчезновение остатка своей стопки. Переданные стопки имеют собственную отметку срока.','full'),
 6403:({'item_creation':[{'key':'food_water','title':'Пища и вода','outputs':[out('food2024',45,H),out('water2024',30,P)]}]},'Создание 45 фунтов пищи и 30 галлонов воды, перенос и расход отдельных единиц. Порча пищи через 24 игровых часа отмечается владельцем.','full'),
 6401:({'item_creation':[{'key':'water','title':'Сотворить воду','choose_count':True,'condition':'В пределах дистанции есть открытый контейнер для воды.','outputs':[out('water2024',10,P,per_slot=10)]}]},'Создание воды в контейнере, выбор количества и усиление от круга ячейки. Уничтожение воды, тушение дождём и рассеивание тумана разрешаются вручную.','partial'),
}
plan=[]
for id,(changes,note,status) in rules.items():
 item=spells[id];plan.append({'id':id,'before':{k:item['data'].get(k) for k in changes},'after':changes,'metadataBefore':{k:item.get(k) for k in ['automationStatus','automationNote','requiresPlayerInteraction']},'metadataAfter':{'automationStatus':status,'automationNote':note,'requiresPlayerInteraction':False}})
for name,data in [('plan',plan),('items',items)]: (root/f'{name}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Prepared 3 spells and 3 items')
