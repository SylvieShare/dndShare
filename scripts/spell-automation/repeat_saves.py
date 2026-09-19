#!/usr/bin/env python3
"""Reviewed repeated end-turn saves. Preserves descriptions, icons and backlinks."""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'review'))
from apply import get, catalogue, update, META

# Explicit effect IDs avoid altering a caster buff that belongs to the same spell.
RULES = {717: [(4705, 3), (4706, 3)], 1126: [(4818, 6)], 882: [(4729, 5)],
         890: [(4820, 3)], 1167: [(4829, 3)], 1197: [(4832, 4)],
         841: [(4779, 5)], 1206: [(4780, 5)], 1104: [(4836, 4)]}
REMAINS = {
 717: 'Условия зрения/слуха, проверки восприятия и преимущество атак по ослеплённой цели проверяются участниками.',
 882: 'Задержка сотворения, ограничения действий/реакций и уменьшение скорости ещё требуют доработки.',
 890: 'Повторное применение атаки бонусным действием и иммунитет к отравлению проверяются участниками.',
 1167: 'Допустимость цели (не нежить и не конструкт) проверяется при применении.',
 1197: 'Штраф к спасброскам концентрации ещё учитывается вручную.',
 841: 'Паралич блокирует сотворение и концентрацию. Автопровалы Силы/Ловкости, атаки по цели и крит вблизи требуют доработки.',
 1206: 'Паралич блокирует сотворение и концентрацию. Автопровалы Силы/Ловкости, атаки по цели и крит вблизи требуют доработки.',
}

def prepare(spells, effects):
    byid = {x['id']: x for x in [*spells, *effects]}; plan = []
    def patch(id, changes, status, note):
        item = byid[id]
        plan.append({'id':id,'typeId':item['typeId'],'changes':{k:{'before':item['data'].get(k),'after':v} for k,v in changes.items()},
          'metadataBefore':{k:item.get(k) for k in META},'metadataAfter':{'automationStatus':status,'automationNote':note,'requiresPlayerInteraction':item.get('requiresPlayerInteraction',False)}})
    for id, effects in RULES.items():
        for effect, ability in effects:
            patch(effect, {'repeat_save':{'ability':ability,'timing':'turn_end'}}, byid[effect]['automationStatus'],
                  'Повторный спасбросок в конце хода использует сохранённую Сл заклинателя; успех снимает выбранный экземпляр. ' + REMAINS.get(id, 'Заданные модификаторы применяются, результат записывается в хронику.'))
        status = 'full' if id in [1126,1104] else 'partial'
        patch(id, {}, status, 'Применение эффекта, модификаторы и повторный спасбросок в конце хода со Сл источника; успех автоматически снимает эффект. ' + REMAINS.get(id, 'Проверены первоначальный спасбросок, формулы при наличии и сохранение результата в хронике.'))
    return plan

def check(item, row):
    if item.get('userId') or item['typeId'] != row['typeId']: raise RuntimeError('Wrong owner/type')
    for k, change in row['changes'].items():
        if item['data'].get(k) not in [change['before'],change['after']]: raise RuntimeError(f'Conflict {item["id"]}: {k}')
    for k in META:
        if item.get(k) not in [row['metadataBefore'][k],row['metadataAfter'][k]]: raise RuntimeError(f'Metadata conflict {item["id"]}: {k}')

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--snapshot');p.add_argument('--apply',action='store_true');a=p.parse_args()
    root=Path(a.directory);root.mkdir(parents=True,exist_ok=True)
    if a.snapshot:
        source=Path(a.snapshot);plan=prepare(json.loads((source/'after-5.json').read_text()),json.loads((source/'after-15.json').read_text()))
        (root/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');print('Prepared',len(plan),'records');sys.exit()
    plan=json.loads((root/'plan.json').read_text());before={row['id']:get(row['id']) for row in plan}
    for row in plan:check(before[row['id']],row)
    print(json.dumps({'preflight':'ok','records':len(plan),'apply':a.apply}),flush=True)
    if a.apply:
        backup=root/'before.json'
        if not backup.exists():backup.write_text(json.dumps(list(before.values()),ensure_ascii=False,indent=2)+'\n')
        for row in plan:
            item=get(row['id']);check(item,row)
            data={**item['data'],**{k:v['after'] for k,v in row['changes'].items()}}
            actual=update(item,data,row['metadataAfter'])
            if any(actual.get(k)!=item.get(k) for k in ['name','nameEn','iconImageId','iconSvgId','compatibility','contentSourceIds']): raise RuntimeError('Unrelated fields changed')
            print(row['id'],actual['name'],flush=True)
        for kind in [5,15]:(root/f'after-{kind}.json').write_text(json.dumps(catalogue(kind),ensure_ascii=False,indent=2)+'\n')
