#!/usr/bin/env python3
"""Explicitly reviewed PHB2024 rules, never inherited by name from PHB2014."""
import argparse, copy, json
from pathlib import Path

# id: (dice count/sides/type, save, on-success, upcast dice)
SAVES = {
 6066: ([(2,10,5)], 'dex','half',[(1,10,5)]),
 6078: ([(1,6,8)], 'dex','negate',[(1,6,8)]),
 6090: ([(2,8,6)], 'con','half',[(1,8,6)]),
 6124: ([(2,10,3),(4,6,13)], 'dex','half',[(1,10,3)]),
 6189: ([(8,8,13)], 'con','half',[(1,8,13)]),
 6192: ([(8,8,10)], 'con','half',[(2,8,10)]),
 6219: ([(20,6,5),(20,6,3)], 'dex','half',[]),
 6232: ([(8,6,9)], 'dex','half',[(1,6,9)]),
 6234: ([(2,10,10)], 'con','half',[(1,10,10)]),
 6258: ([(7,10,5)], 'dex','half',[]),
 6260: ([(3,6,5)], 'dex','half',[(1,6,5)]),
 6262: ([(8,6,5)], 'dex','half',[(1,6,5)]),
 6359: ([(1,6,6)], 'con','negate',[(1,6,6)]),
 6374: ([(1,8,7)], 'dex','negate',[(1,8,7)]),
 6388: ([(1,6,7)], 'con','negate',[(1,6,7)]),
}
ATTACKS = {6261:(1,10,5),6419:(1,6,1),6455:(1,12,4)}
META = ['automationStatus','automationNote','requiresPlayerInteraction']

def dice(rows): return [{'count':n,'dice_id':f'd{s}','type':t} for n,s,t in rows]
def prepare(spells, effects):
    byid={x['id']:x for x in spells}; effect_byid={x['id']:x for x in effects}; plans={}; created=[]
    def patch(id, fields, note, status='full'):
        x=byid[id]
        if not any(c['sourceVersionId']==1799 and c['status']=='native' for c in x['compatibility']): raise ValueError('Wrong edition')
        plan=plans.setdefault(id,{'id':id,'name':x['name'],'changes':{},'effectsBefore':x['data'].get('status_effects',[]),'metadataBefore':{k:x.get(k) for k in META}})
        plan['changes'].update({k:{'before':x['data'].get(k),'after':v} for k,v in fields.items()})
        plan.update(automationStatus=status,automationNote=note,requiresPlayerInteraction=False)
    for id,(base,save,result,addon) in SAVES.items():
        rule={'dices':dice(base),'addon':dice(addon),'scaling':'cantrip' if byid[id]['data']['lvl']==0 else 'slot' if addon else 'none','save_ability':save,'save_effect':result}
        if id==6374: rule['save_condition']='Бонусы +2/+5 от укрытия не применяются к этому спасброску.'
        patch(id,{'damage':rule},'Правила 2024: типизированный урон, усиление, спасбросок и применение полного/половинного урона либо избегание через хронику. Геометрию, перемещения и воздействие на декорации определяет мастер.')
    for id,part in ATTACKS.items():
        patch(id,{'damage':{'dices':dice([part]),'addon':dice([part]),'scaling':'cantrip','range_attack':True}},'Правила 2024: атака заклинанием, усиление заговора, крит и типизированный урон с применением к цели. Перемещение и воздействие на декорации определяет мастер.')
    desc=byid[6261]['data']['description']
    corrected=desc
    for n in [1,2,3,4]: corrected=corrected.replace(f'{n}к6',f'{n}к10')
    if corrected==desc: raise ValueError('Expected imported Fire Bolt typo changed; review again')
    patch(6261,{'description':corrected},plans[6261]['automationNote']+' Опечатка усиления к6 исправлена на к10 по официальным Basic Rules 2024.')
    for id,n,s,addon,count in [(6200,2,4,2,1),(6201,2,8,2,1),(6228,2,4,1,6),(6229,5,8,1,6)]:
        heal={'dices':[{'count':n,'dice_id':f'd{s}'}],'addon':[{'count':addon,'dice_id':f'd{s}'}],'scaling':'slot','add_mod':True}
        patch(id,{'heal':heal,'application_targets':{'count':count}},f'Правила 2024: лечение {n}к{s} + модификатор заклинателя, +{addon}к{s} за круг выше; выбор до {count} целей, расход ячейки и результат в хронике.')
    patch(6293,{k:copy.deepcopy(byid[513]['data'][k]) for k in ['damage','rolls']},'Правила 2024: отдельные формулы к8 для полной шкалы ХП и к12 для раненой цели, усиление заговора и спасбросок Мудрости. Условие выбирается перед броском; урон применяется через хронику.')
    # Each native effect has independent source, duration and concentration semantics.
    for id,old,targets,minutes in [(6074,4656,{'count':3,'per_slot':1},1),(6076,4694,{'self_only':True},1),
                                (6381,4765,{'count':1,'per_slot':1},60),(6452,4605,{'count':1},10),
                                *[(6161,e,{'count':1},60) for e in [4732,4733,4734,4735,4736]]]:
        source=byid[id]; template=effect_byid[old]; key=f'spell_{id}_effect_{old}'
        concentration=source['data'].get('concentration',False); duration={'kind':'hours','value':1} if minutes==60 else {'kind':'minutes','value':minutes}
        data=copy.deepcopy(template['data']);data.update(code=key,duration=duration,concentration=concentration,
             application_sources=[{'item':{'id':id},'key':key,'target':'self' if targets.get('self_only') else 'other'}])
        for row in data.get('weapon_damage',[]): row['key']=key
        created.append({'spellId':id,'key':key,'name':source['name']+((': '+template['name'].split(': ')[-1]) if id==6161 else ''),
            'nameEn':source.get('nameEn',''),'data':data,'duration':duration,'condition':'','apply_on':'cast'})
        patch(id,{'application_targets':targets},'Правила 2024: применение эффекта, длительность, модификаторы и число целей; '+('связь с концентрацией.' if concentration else 'без концентрации.'))
    # New chain configuration is consumed by the same chronicle sequence runner.
    patch(6444,{'damage':{'dices':[{'count':3,'dice_id':'d8'}],'addon':[{'count':1,'dice_id':'d8'}],'scaling':'slot','range_attack':True,
        'type_choices':[6,8,5,13,9,4], 'attack_chain':{'trigger':'matching_dice','sides':8,'matches':2,'max_jumps':1,'jumps_per_slot':1,'distance':30,'origin':'previous','unique':'target'}}},
        'Правила 2024: тип выбирается при сотворении; совпадение любой пары к8 открывает перескок. Лимит перескоков равен кругу ячейки; каждая цель только один раз. Усиление, крит и отдельный урон целей поддержаны в хронике сессии. Без сессии доступны самостоятельные броски; связанной цепочки пока нет.','partial')
    return list(plans.values()),created

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('snapshot');p.add_argument('directory');a=p.parse_args()
    source=Path(a.snapshot);target=Path(a.directory);target.mkdir(parents=True,exist_ok=True)
    plans,effects=prepare(json.loads((source/'after-5.json').read_text()),json.loads((source/'after-15.json').read_text()))
    for name,rows in [('plan',plans),('effects',effects)]: (target/f'{name}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    print('Prepared',len(plans),'spells and',len(effects),'effects')
