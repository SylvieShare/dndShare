#!/usr/bin/env python3
"""Prepare 391 PHB 2024 spells from visually ordered PDF blocks; no writes."""
import argparse,copy,json,re
from pathlib import Path
from content_common import Catalogue,flat,key,ref,rich,sections,unwrap
# IDs checked against the application's school dictionary (suggest type 7).
SCHOOLS={'Воплощение':1,'Очарование':2,'Ограждение':3,'Иллюзия':4,'Преобразование':5,'Призыв':6,'Прорицание':7,'Некромантия':8}

def prepare(pages,catalogue,aliases=None):
    spells=sections(pages,239,346)
    if len(spells)!=391:raise ValueError(f'Expected 391 spells, got {len(spells)}')
    for section in spells:
        name=section['name'].replace('двой ник','двойник');blocks=section['blocks'];body=flat(blocks)
        header=re.match(r'(Заговор|[1-9]\s+[Уу]ровень),\s*('+ '|'.join(SCHOOLS)+r')\s*\(([^)]+)\)',body)
        if not header:raise ValueError('Missing spell header: '+name)
        level,school,class_names=header.groups()
        end_header=next((i for i,b in enumerate(blocks) if 'Длительность:' in b['text']),None)
        if end_header is None:raise ValueError('Missing duration: '+name)
        metadata=flat(blocks[1:end_header+1])
        parts=re.search(r'Время сотворения:\s*(.*?)Дистанция:\s*(.*?)Компоненты:\s*(.*?)Длительность:\s*(.*)',metadata,re.S)
        if not parts:raise ValueError('Missing structured header: '+name)
        casting,range_text,components,duration=map(unwrap,parts.groups())
        cast={'kind':'action'}
        if casting.startswith('Бонусное действие'):cast={'kind':'bonus_action'}
        elif casting.startswith('Реакция'):cast={'kind':'reaction','condition':casting.removeprefix('Реакция').strip(' ,')}
        elif m:=re.match(r'(\d+)\s*(минут|час)',casting):cast={'kind':'minutes' if m[2]=='минут' else 'hours','value':int(m[1])}
        distance={'kind':'ranged'}
        if range_text=='На себя':distance={'kind':'self'}
        elif range_text=='Касание':distance={'kind':'touch'}
        elif m:=re.fullmatch(r'(\d+)\s+фут(?:ов|а)?',range_text):distance.update(unit='feet',distance=int(m[1]))
        else:distance={'kind':'custom','text':range_text}
        comp={k:bool(re.search(r'(?<![А-Яа-я])'+letter+r'(?![А-Яа-я])',components))for k,letter in [('v','В'),('s','С')]}
        if 'М ('in components:comp['m']=components.split('М (',1)[1].rstrip(')')
        old=catalogue.original(name,5,(aliases or {}).get(name))
        data={'lvl':0 if level=='Заговор'else int(level[0]),'schoolId':SCHOOLS[school],
          'time':cast,'range':distance,'components':comp,'duration':duration,'ritual':'Ритуал'in casting,
          'concentration':'Концентрация'in duration,'description':rich(blocks[end_header+1:]),
          'classes':[{'id':ref(key('class',unwrap(c)))}for c in class_names.split(',')]}
        r=catalogue.add('spell',name,5,data,section['page'],old)
        # These revised healing dice and slot increments are directly specified
        # in the 2024 text. Other old automation is deliberately not inherited.
        healing={'Лечение ран':(2,'d8'),'Лечащее слово':(2,'d4'),'Множественное лечащее слово':(2,'d4'),'Множественное лечение ран':(5,'d8')}
        if name in healing:
            count,die=healing[name];increment=2 if name in ['Лечение ран','Лечащее слово']else 1
            data['heal']={'dices':[{'count':count,'dice_id':die}],'addon':[{'count':increment,'dice_id':die}],'add_mod':True,'scaling':'slot'}
            r['automationStatus']='partial';r['automationNote']='Формула лечения и рост от ячейки по PHB 2024; выбор допустимых целей по описанию.'
    return catalogue.records

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('blocks');p.add_argument('catalogue');p.add_argument('output');args=p.parse_args()
    c=Catalogue(json.loads(Path(args.catalogue).read_text()))
    records=prepare(json.loads(Path(args.blocks).read_text()),c)
    Path(args.output).write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'spells':len(records),'matched':sum(bool(r['originalId'])for r in records),'unmatched':[r['name']for r in records if not r['originalId']]},ensure_ascii=False))
