#!/usr/bin/env python3
"""Reviewed, freely chosen damage types. Run with review/apply.py over MCP."""
import argparse, copy, csv, json
from collections import Counter
from pathlib import Path
# IDs reference suggest type 12. Preserve each spell's exact allowed set.
CHOICES = {
    688: ('damage', [6, 8, 5, 13, 9, 4]),
    726: ('damage', [8, 13, 5, 9, 4]),
    811: ('damage', [8, 13, 5, 9, 7]),
    848: ('damage', [8, 13, 5, 9, 4, 6]),
    928: ('damage', [6, 8, 5, 13, 9]),
    940: ('damage', [7, 10, 13]),
    1077: ('rolls', [6, 8, 5, 13, 9]),
    1127: ('rolls', [8, 9, 4, 5, 13]),
    1184: ('damage', [7, 10]),
    1221: ('damage', [7, 10]),
    1349: ('damage', [8, 13, 5, 9, 10, 4]),
    1396: ('damage', [13, 5, 9, 10, 7]),
}
LIMITS = {
    726: 'Наделение другого существа действием дыхания и его повторения пока вручную.',
    811: 'Дополнительный урон рогов бросается отдельно. Привязка к атаке существа и противоречие описания роста сверх 3-го при базовом 2-м круге требуют разбора.',
    848: 'Тип применяется к костям и модификатору заклинателя. Создание клинка и его использование вместо отдельных атак пока вручную.',
    928: 'Поддержана взрывная руна. Условия срабатывания, хранение другого заклинания и разрушение руны пока вручную.',
    940: 'Отдельный бросок дополнительного урона поддержан. Связь с попаданием, запрет лечения и контекст снижения скорости требуют отдельной механики.',
    1077: 'Поддержан дополнительный урон выбранного вида. Снятие сопротивления, первое срабатывание за ход и окончание проклятия пока вручную.',
    1127: 'Доступны тип дыхания и бросок перезарядки. Выбранный дракон, форма области и готовность повторного дыхания контролируются участниками.',
    1184: 'Постоянные 5к6 звуком сохранены; выбор относится только ко вторым 5к6. Падение ничком и его последствия пока вручную.',
    1221: 'Урон выбранного вида поддержан. Допустимые виды существ, пароль, барьер перемещения и постоянство области пока вручную.',
    1349: 'Урон дыхания поддержан. Испуг, повторные спасброски, распознавание иллюзии и преимущество против неё пока вручную.',
    1396: 'Добавлена формула 6к6 с выбором типа и спасброском Телосложения на половину. Повторные срабатывания и превращение в пепел при 0 хитах пока вручную.',
}
DEFERRED = {
    675: 'Снаряд хаоса: тип выбирается после броска из значений выпавших к8, также нужны перескоки.',
    699: 'Бешеный снаряд: случайный тип по таблице и перескоки, свободный выбор неверен.',
    869: 'Вызов заграждения: тип берётся у оружия или боеприпаса.',
    1115: 'Вызов залпа: тип берётся у оружия или боеприпаса.',
    609: 'Метка охотника: тип следует урону попавшего оружия.',
    880: 'Духовные стражи: тип определяется мировоззрением, а не свободным выбором.',
    642: 'Поглощение стихий: тип определяется входящим уроном и связан с сопротивлением.',
    1055: 'Огненный щит: ответный урон должен следовать варианту активного щита.',
    560: 'Волшебное оружие: выбор уже есть в вариантах связанных эффектов; нужен единый выбор для эффекта и отдельного броска.',
    984: 'Стихийное оружие: выбор уже есть в вариантах связанных эффектов; нужен единый выбор для эффекта и отдельного броска.',
}

def prepare(spells):
    byid = {x['id']:x for x in spells}; plan=[]
    for id,(field,types) in CHOICES.items():
        item=byid[id]; data=copy.deepcopy(item['data']); rule=data[field][0] if field=='rolls' else data[field]
        rule['type_choices']=types
        if id==1396:
            rule.update(dices=[{'count':6,'dice_id':'d6'}],scaling='none',save_ability='con',save_effect='half',save_manual=False)
        assert any(not row.get('type') for row in rule.get('dices',[])), f'No variable damage in {id}'
        note='Выбор типа урона, типизированная формула, цвет костей и применение защит цели поддержаны. '
        note += LIMITS.get(id, 'Атака, 3к8 и +1к8 за каждый круг выше первого, критическое попадание и применение к целям из хроники поддержаны.')
        plan.append({'id':id,'name':item['name'],'changes':{field:{'before':item['data'].get(field),'after':data[field]}},
            'automationStatus':'full' if id==688 else 'partial','automationNote':note,'requiresPlayerInteraction':item.get('requiresPlayerInteraction',False),
            'metadataBefore':{k:item.get(k,False if k=='requiresPlayerInteraction' else '') for k in ['automationStatus','automationNote','requiresPlayerInteraction']},'effectsBefore':item['data'].get('status_effects',[])})
    return plan

def verify(root,output):
    spells=json.loads((root/'after-5.json').read_text()); byid={x['id']:x for x in spells}; plan=json.loads((root/'plan.json').read_text())
    for spec in plan:
        actual=byid[spec['id']]
        for key in ['automationStatus','automationNote','requiresPlayerInteraction']: assert actual.get(key)==spec[key], (spec['id'],key)
        for key,change in spec['changes'].items(): assert actual['data'].get(key)==change['after'], (spec['id'],key)
    before=json.loads((root/'before-apply.json').read_text())['spells']
    for original in before:
        actual=byid[original['id']]
        assert actual['name']==original['name'] and actual['data']['description']==original['data']['description']
    assert byid[1184]['data']['damage']['dices'][0]['type']==6
    output.mkdir(parents=True,exist_ok=True)
    summary={'updated':len(plan),'additionalToChromaticOrb':len(plan)-1,'verifiedIds':[x['id'] for x in plan],'statuses':dict(Counter(x['automationStatus'] for x in spells)),'deferred':DEFERRED}
    (output/'damage-type-choices.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    with (output/'spells.csv').open('w') as f:
        w=csv.writer(f,lineterminator='\n'); w.writerow(['id','name','automation_status','requires_player_interaction','note'])
        w.writerows([x['id'],x['name'],x['automationStatus'],x.get('requiresPlayerInteraction',False),x.get('automationNote','')] for x in spells)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);p.add_argument('--verify',action='store_true');a=p.parse_args()
    if a.verify:verify(a.input,a.output)
    else:
        plan=prepare(json.loads(a.input.read_text()));a.output.mkdir(parents=True,exist_ok=True)
        (a.output/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');(a.output/'effects.json').write_text('[]\n')
        print(f'{len(plan)} spells, including Chromatic Orb')
