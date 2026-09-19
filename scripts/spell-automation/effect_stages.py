#!/usr/bin/env python3
"""Reviewed independent saves and a casting-only ward; no text inference."""
import argparse, copy, json
from pathlib import Path

def prepare(rows):
    items = {row['id']: row for row in rows}; plans, effects = [], []
    def plan(id, after, note):
        item = items[id]
        plans.append({'id': id, 'name': item['name'], 'changes': {key: {'before': item['data'].get(key), 'after': value} for key, value in after.items()},
            'automationStatus': 'partial', 'automationNote': note, 'requiresPlayerInteraction': item.get('requiresPlayerInteraction', False),
            'metadataBefore': {key: item.get(key) for key in ['automationStatus', 'automationNote', 'requiresPlayerInteraction']},
            'effectsBefore': item['data'].get('status_effects', [])})
    def save(label, ability, dc, condition):
        return {'kind': 'save', 'label': label, 'save_ability': ability, 'save_dc': dc, 'save_condition': condition}
    plan(725, {'rolls': items[725]['data'].get('rolls', []) + [save('Скользкий лёд', 'dex', 10, 'В конце хода на льду; провал — существо падает ничком.')]},
         'Поддержаны отдельные формулы урона в конце хода и объявление спасброска Ловкости Сл 10 на льду. Захват, удушение, проверки Силы для освобождения и разрушение льда остаются отдельными действиями мастера.')
    plan(908, {'damage': {'save_ability': 'int', 'save_effect': 'negate'}, 'rolls': items[908]['data'].get('rolls', []) + [save('Выход из лабиринта', 'int', 12, 'При попытке найти выход; успех заканчивает действие на цель.')]},
         'Первоначальный спасбросок Интеллекта использует Сл заклинателя; последующие попытки выхода — отдельный этап со Сл 12. Перенос в лабиринт и возвращение цели пока разрешаются вручную.')
    links = copy.deepcopy(items[1279]['data']['status_effects'])
    for link in links: link['apply_on'] = 'cast'
    plan(1279, {'status_effects': links, 'rolls': items[1279]['data'].get('rolls', []) + [save('После окончания трансформации', 'con', 15, 'Сразу после окончания заклинания; провал добавляет один уровень истощения.')]},
         'Усиление применяется при сотворении. Отдельно объявляется спасбросок Телосложения Сл 15 после окончания; он не накладывает усиление повторно. Временные хиты с источником, их снятие и применение истощения ещё требуют доработки.')
    id=1394; key='spell_1394_ward'; duration={'kind':'minutes','value':1}
    plan(id, {'application_targets': {'self_only': True}},
         'При сотворении на себя накладываются минимум итогового КД 20 и иммунитет некротическому урону. Спасброски Мудрости ауры объявляются отдельно; они не накладывают личное усиление на врага. Иммунитет страху, опутывание и невосприимчивость к повторной ауре требуют доработки.')
    effects.append({'spellId':id,'key':key,'name':'Квинтэссенция: небесная защита','nameEn':'Quintessence ward','apply_on':'cast','condition':'Личное усиление заклинателя.','duration':duration,
        'data': {'code':key,'desc':'КД не может быть ниже 20; некротический урон не причиняет вреда. Действует во время концентрации.',
            'polarity':'positive','stacking':'single','concentration':True,'duration':duration,
            'derived_effects':[{'kind':'armor_minimum','value':20}], 'defenses':[{'kind':'immunity','damage_type':10}],
            'application_sources':[{'item':{'id':id},'key':key,'target':'self','condition':'При сотворении заклинания.'}]}})
    return plans, effects

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('snapshot');p.add_argument('directory');args=p.parse_args()
    plans,effects=prepare(json.loads(Path(args.snapshot).read_text()));root=Path(args.directory);root.mkdir(parents=True,exist_ok=True)
    for name,rows in [('plan',plans),('effects',effects)]: (root/f'{name}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    print('Prepared 4 spells and 1 effect.')
