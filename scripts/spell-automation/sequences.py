#!/usr/bin/env python3
"""Explicit XGE/MHH result tables; writes use review/apply.py over MCP."""
import copy, json, sys
from pathlib import Path

RULES = {
    675: ('damage', 8, 2, [8, 13, 5, 12, 9, 4, 11, 6], 'matching_damage', 30, 'previous', 'target'),
    699: ('separate', 10, 1, [8, 13, 5, 12, 9, 10, 4, 11, 7, 6], 'odd_attack', 120, 'caster', 'hit'),
}

def prepare(items):
    plan = []
    for item in items:
        if item['id'] not in RULES: continue
        source, sides, count, types, trigger, distance, origin, unique = RULES[item['id']]
        before = item['data']['damage']; after = copy.deepcopy(before)
        after['roll_table'] = {'source':source, 'sides':sides, 'count':count, 'rows':[{'value':i+1,'damage_type':id} for i,id in enumerate(types)]}
        after['attack_chain'] = {'trigger':trigger, 'distance':distance, 'origin':origin, 'unique':unique}
        note = ('В хронике сессии поддержаны таблица типа после броска, цепочка атак, отдельный урон каждой цели, усиление, крит и общая история целей без повторного расхода ячейки. '
                'Мастер выбирает цель, проверяет расстояние и подтверждает попадание; автор может выбрать тип урона. '
                'Сценарий без сессии пока не поддержан, доступны самостоятельные броски. ')
        note += 'Тип и перескок определяют первые две базовые к8; дополнительные кости крита не расширяют этот набор.' if item['id']==675 else 'Тип определяется отдельной к10; перескок — нечётным основным к20 при попадании. Увеличивается число снарядов, не урон попадания.'
        plan.append({'id':item['id'],'name':item['name'],'changes':{'damage':{'before':before,'after':after}},'automationStatus':'partial',
                     'automationNote':note,'requiresPlayerInteraction':item.get('requiresPlayerInteraction',False),
                     'metadataBefore':{key:item.get(key,False if key=='requiresPlayerInteraction' else '') for key in ['automationStatus','automationNote','requiresPlayerInteraction']},
                     'effectsBefore':item['data'].get('status_effects',[])})
    assert len(plan)==len(RULES)
    return plan

if __name__ == '__main__':
    root=Path(sys.argv[2]); root.mkdir(parents=True,exist_ok=True)
    (root/'plan.json').write_text(json.dumps(prepare(json.loads(Path(sys.argv[1]).read_text())),ensure_ascii=False,indent=2)+'\n')
    (root/'effects.json').write_text('[]\n')
