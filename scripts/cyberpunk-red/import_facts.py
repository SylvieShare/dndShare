"""Normalize factual Core game parameters into the application's own data format.

Source of rules: user-provided Core 1.25 + RTG errata. The Project RED compendium
is a secondary numerical index, pinned by commit. No software, artwork, prose,
Foundry effects, IDs, templates or migration code are copied into the product.
"""
import argparse
import json
import re
from pathlib import Path
import yaml

GROUPS = {'ammo':'Боеприпасы','armor':'Броня','clothing':'Одежда',
 'critical-injuries-body':'Травмы тела','critical-injuries-head':'Травмы головы',
 'cyberware':'Киберимпланты','drugs':'Препараты','gear':'Снаряжение',
 'programs':'Программы','roles':'Роли','upgrades':'Модификации','vehicles':'Транспорт','weapons':'Оружие'}

def slug(name):
    return re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')

def numeric_facts(system, kind):
    facts={'price':system.get('price',{}).get('market',0),'quantity':system.get('amount',1)}
    if kind=='weapon' or system.get('isWeapon'):
        facts.update(damage=system.get('damage'),skill=slug(system.get('weaponSkill','')),
          weaponType=system.get('weaponType'),rof=system.get('rof',1),hands=system.get('handsReq',1),
          ranged=system.get('isRanged',False),quality=system.get('quality','standard'),
          magazine=system.get('magazine',{}).get('max',0),ammo=system.get('ammoVariety',[]),
          autofire=system.get('fireModes',{}).get('autoFire',0),suppressiveFire=system.get('fireModes',{}).get('suppressiveFire',False),
          conceal=system.get('concealable',{}).get('concealable',False),
          ignoreArmorPercent=system.get('ignoreArmorPercent',0) if system.get('canIgnoreArmor') else 0)
    if kind=='armor':
        facts.update(headSP=system.get('headLocation',{}).get('sp',0),bodySP=system.get('bodyLocation',{}).get('sp',0),
          penalty=system.get('penalty',0),shieldHP=system.get('shieldHitPoints',{}).get('max',0))
    if kind=='cyberware':
        facts.update(cyberCategory=system.get('type'),foundation=system.get('isFoundational',False),
          slots=system.get('installedItems',{}).get('slots',0),size=system.get('size',1),
          humanity=system.get('humanityLoss',{}).get('static',0),humanityRoll=system.get('humanityLoss',{}).get('roll','0'),
          surgery=system.get('installLocation'),weapon=system.get('isWeapon',False))
    if kind=='program':
        facts.update(programClass=system.get('class'),atk=system.get('atk',0),defense=system.get('def',0),
          rez=system.get('rez',{}).get('max',0),size=system.get('size',1))
        if system.get('class')=='antiprogramattacker':facts.update(standardDamage=system['damage']['standard'],blackIceDamage=system['damage']['blackIce'])
    if kind=='ammo':
        facts.update(ammoType=system.get('type'),ammoVariety=system.get('variety'),ablation=system.get('ablationValue',1))
    if kind=='cyberdeck': facts.update(slots=system.get('installedItems',{}).get('slots',0))
    if kind=='vehicle': facts.update(sdp=system.get('sdp',0),seats=system.get('seats',0),move=system.get('speedCombat',0))
    if kind=='itemUpgrade': facts.update(size=system.get('size',1),upgradeType=system.get('type'))
    if kind=='criticalInjury':
        facts.update(location=system.get('location'),deathPenalty=1 if system.get('deathSaveIncrease') else 0,
          firstAidDV=system.get('quickFix',{}).get('dvFirstAid',0),paramedicDV=system.get('quickFix',{}).get('dvParamedic',0),
          treatmentParamedicDV=system.get('treatment',{}).get('dvParamedic',0),surgeryDV=system.get('treatment',{}).get('dvSurgery',0))
    if kind=='role': facts.update(roleKey=slug(system.get('mainRoleAbility','')),startingRank=4)
    return facts

BONUS_TARGETS={'initiative':'initiative','allActions':'all-actions','allActionsHands':'hands','allActionsSpeech':'speech',
 'melee':'melee','ranged':'ranged','perceptionHearing':'perception-hearing','perceptionSight':'perception-sight',
 'hands':'hands','hasPainSuppression':'pain-suppression','run':'run','aimedShot':'aimed','singleShot':'single-shot',
 'personalGrooming':'personal-grooming','wardrobeAndStyle':'wardrobe-style','concealOrRevealObject':'conceal-reveal-object',
 'electronicsAndSecurityTech':'electronics-security-tech','resistTortureOrDrugs':'resist-torture-drugs',
 'playInstrument(Singing)':'play-instrument:singing','cloak':'net:cloak','pathfinder':'net:pathfinder','speed':'net:speed','backdoor':'net:backdoor'}

def bonuses(document):
    out=[]
    for effect in document.get('effects',[]):
        situational=effect.get('flags',{}).get('cyberpunk-red-core',{}).get('changes',{}).get('situational',{})
        for index,change in enumerate(effect.get('changes',[])):
            value=str(change.get('value',''))
            if not re.fullmatch(r'-?\d+',value) or change.get('mode')!=2:continue
            raw=change.get('key','')
            if raw.startswith('system.stats.'):
                target='stat:'+raw.split('.')[2].upper()
            elif raw.startswith('bonuses.'):
                key=raw[8:];target=BONUS_TARGETS.get(key) or re.sub(r'([a-z])([A-Z])',r'\1-\2',key).lower()
            else:continue
            out.append({'target':target,'value':int(value),'conditional':bool(situational.get(str(index),{}).get('isSituational',False))})
    return out

def summary(record):
    f=record['facts'];kind=record['kind'];bits=[]
    if f.get('damage'):bits += [f"Урон {f['damage']}",f"темп огня {f['rof']}",f"навык {f['skill']}"]
    if f.get('magazine'):bits.append(f"магазин {f['magazine']}")
    if kind=='armor':
        if f['bodySP']:bits.append(f"защита тела SP {f['bodySP']}")
        if f['headSP']:bits.append(f"защита головы SP {f['headSP']}")
        if f['shieldHP']:bits.append(f"щит: {f['shieldHP']} HP")
        bits.append(f"штраф REF/DEX/MOVE {f['penalty']}")
    if kind=='cyberware':
        bits += [f"установка: { {'mall':'торговый центр','clinic':'клиника','hospital':'госпиталь'}.get(f['surgery'],f['surgery'])}",f"потеря человечности при создании {f['humanity']}; после создания {f['humanityRoll']}",f"занимает слотов: {f['size']}"]
        if f.get('foundation'):bits.append(f"основная установка, вместимость {f['slots']}")
    if kind=='ammo':bits += [f"совместимость: {f['ammoVariety']}",f"тип: {f['ammoType']}",f"износ брони при пробитии: {f['ablation']}"]
    if kind=='program':bits += [f"класс: {f['programClass']}",f"ATK {f['atk']}, DEF {f['defense']}, REZ {f['rez']}",f"слотов: {f['size']}"]
    if kind=='vehicle':bits += [f"SDP {f['sdp']}",f"мест: {f['seats']}",f"перемещение: {f['move']}"]
    for b in f.get('bonuses',[]):bits.append(f"{b['target']} {b['value']:+d}"+(' при выполнении условия' if b['conditional'] else ''))
    if f.get('paired'):bits.append('эффект требует парной установки')
    if not bits:bits.append(f"{GROUPS[record['category']]}; стоимость {f['price']} eb за {f['quantity']} шт.")
    text='; '.join(bits)
    return text[0].upper()+text[1:]+'.'

def build(reference):
    records=[]
    for group,title in GROUPS.items():
        translation_path=reference/'src/babele/ru'/f'cyberpunk-red-core.core_{group}.json'
        translated=json.loads(translation_path.read_text(encoding='utf-8'))['entries'] if translation_path.exists() else {}
        for file in sorted((reference/'src/packs/core'/group).glob('*.yaml')):
            document=yaml.safe_load(file.read_text(encoding='utf-8')); system=document['system']
            sources=system.get('sources') or [system.get('source') or {}]
            page=next((s.get('page') for s in sources if s.get('book') in ['Cyberpunk RED','Core']),None)
            if page is None: raise ValueError(f'No Core page for {file}')
            name=document['name']; kind=document['type']; facts=numeric_facts(system,kind)
            effect_facts=bonuses(document)
            if effect_facts:facts['bonuses']=effect_facts
            facts['paired']=bool(re.search(r'must be paired|requires paired',system.get('description',{}).get('value',''),re.I)) if kind=='cyberware' else False
            record={'key':slug(file.stem),'category':group,'name':translated.get(name,{}).get('name') or name,
                    'nameEn':name,'page':page,'kind':kind,'facts':facts}
            record['summary']=summary(record)
            records.append(record)
    if len({r['key'] for r in records})!=len(records):raise ValueError('Duplicate keys')
    dictionaries={}
    for key,title in [('skills-languages','Языки'),('skills-local-expert','Местности'),('skills-science','Науки'),('skills-play-instrument','Музыкальные инструменты'),('skills-martial-arts','Боевые искусства')]:
        path=reference/'src/babele/ru'/f'cyberpunk-red-core.core_{key}.json'
        names=json.loads(path.read_text(encoding='utf-8'))['entries'] if path.exists() else {}
        values=[]
        for path in sorted((reference/'src/packs/core'/key).glob('*.yaml')):
            value=yaml.safe_load(path.read_text(encoding='utf-8'))['name']
            values.append({'key':slug(value),'name':names.get(value,{}).get('name') or value,'description':value})
        dictionaries[title]=values
    return {'revision':'core-1.25-1','source':'Cyberpunk RED Core Rulebook v1.25','referenceDictionaries':dictionaries,
            'groups':GROUPS,'items':records,'provenance':{'bookSha256':'aece6513e81347acecb06e1544ec281d44b9eed2e99ec7c4ecfc766b6856b295',
            'numericalIndex':'https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core',
            'numericalIndexCommit':'165701e886aacf50983e12875db57ae047de6fa5'}}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('reference',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
    result=build(a.reference);a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(len(result['items']), 'records')
