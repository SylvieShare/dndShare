"""Equipment facts checked against PHB tables; updated rules get separate IDs."""
import copy,re
from content_common import flat,key,norm,ref,rich,sections,unwrap
from aliases import GEAR

NAME_ALIASES={'Проклёпанный кожаный доспех':'Проклёпанная кожа','Стёганный доспех':'Стёганый доспех','Инструменты ремонтника':'Инструменты жестянщика','Инструменты отравителя':'Набор отравителя','Дорожная одежда':'Одежда, дорожная','Отличная одежда':'Одежда, отличная','Ручной топор':'Одноручный топор','Священный символ':'Амулет','Зеркало':'Зеркало, стальное','Горшок, железный':'Горшок, чугунный','Верёвка':'Верёвка, пеньковая','Калтропы':'Калтропы (мешок из 20 штук)','Металлические шарики':'Металлические шарики (1000 штук)','Леска':'Леска','Шипы, железные':'Шипы, железные (10 штук)','Рационы':'Рационы (1 день)','Бумага':'Бумага (1 лист)','Пергамент':'Пергамент (1 лист)','Чернила':'Чернила (1 унция)','Масло':'Масло (фляга)','Кислота':'Кислота (флакон)','Алхимический огонь':'Алхимический огонь (фляга)','Святая вода':'Святая вода (фляга)','Яд, простой':'Яд, простой (флакон)','Противоядие':'Противоядие (флакон)'}
CURRENCIES={'ММ':1,'СМ':2,'ЗМ':3}

def fraction(text):
    return sum(float(v.split('/')[0])/float(v.split('/')[1])if '/'in v else float(v)for v in text.split())if text!='—'else 0

def prepare(pages,raw,catalogue,metadata):
    byname={};sets={};shared=[]
    def old_for(name,type_id):
        direct=catalogue.original(name,type_id,GEAR.get(name)) or catalogue.original(NAME_ALIASES.get(name,name),type_id)
        if not direct:
            matches=[i for i in catalogue.items if i['type_id']==type_id and norm(i['name']).split(' (')[0]==norm(NAME_ALIASES.get(name,name)).split(' (')[0]]
            if len(matches)==1:direct=matches[0]
        return direct
    def register(record,name=None):byname[norm(name or record['name'])]=ref(record['key'])
    def gear(name):
        n=norm(name)
        if n in byname:return byname[n]
        alias=NAME_ALIASES.get(name)
        if alias and norm(alias)in byname:return byname[norm(alias)]
        raise ValueError('Missing 2024 equipment: '+name)
    # Same armor numbers, costs, weights, and strength/stealth requirements.
    # The edition's general don/doff rules are documented by its rules profile.
    armor_facts={'Padded Armor':(11,8,5,0,True),'Leather Armor':(11,10,10,0,False),'Studded Leather Armor':(12,13,45,0,False),'Hide Armor':(12,12,10,0,False),'Chain Shirt':(13,20,50,0,False),'Scale Mail':(14,45,50,0,True),'Breastplate':(14,20,400,0,False),'Half Plate Armor':(15,40,750,0,True),'Ring Mail':(14,40,30,0,True),'Chain Mail':(16,55,75,13,True),'Splint Armor':(17,60,200,15,True),'Plate Armor':(18,65,1500,15,True),'Shield':(2,6,10,0,False)}
    for i in catalogue.items:
        if i['type_id']==12 and i.get('name_en')in armor_facts:
            d=i['data'];a=d['armor'];actual=(a.get('shield_bonus')if a.get('shield')else a['ac'],d['weight'],d['cost']['value'],d.get('strength_required',0),bool(d.get('stealth_disadvantage')))
            if actual!=armor_facts[i['name_en']]or d['cost']['suggest_id']!=3:raise ValueError('Shared armor facts changed: '+i['name'])
            byname[norm(i['name'])]=i['id'];shared.append(i['id'])
    if len(shared)!=13:raise ValueError('Expected 13 reviewed armor records')
    tags={s['value'].casefold():s['id']for s in metadata['suggests']if s['type_id']==14}
    masteries={s['name']:rich(s['blocks'])for s in sections(pages,213,215)}
    source=raw[215];military=False;ranged=False
    starts=list(re.finditer(r'(?m)^([^\n]+?)\s+(\d+к\d+|1)\s+(Колющий|Рубящий|Дробящий)\b',source))
    if len(starts)!=38:raise ValueError('Expected 38 weapons, got '+str(len(starts)))
    mastery_names=['Быстрое','Задевающее','Замедляющее','Опрокидывающее','Ослабляющее','Отвлекающее','Отталкивающее','Рассекающее']
    for pos,m in enumerate(starts):
        text=unwrap(source[m.end():starts[pos+1].start()if pos+1<len(starts)else len(source)])
        preceding=source[:m.start()]
        category=list(re.finditer(r'(Простое|Воинское) (рукопашное|дальнобойное) оружие',preceding))[-1]
        military=category[1]=='Воинское';ranged=category[2]=='дальнобойное'
        facts=re.search(r'('+ '|'.join(mastery_names)+r')\s+([0-9/ ]+|—)(?:\s+фнт)?\s+(\d+)\s+(ЗМ|СМ|ММ)',text)
        if not facts:raise ValueError('Missing weapon facts '+m[1])
        name=m[1].strip();old=old_for(name,1);properties=text[:facts.start()].strip()
        damage_type={'Колющий':1,'Рубящий':2,'Дробящий':3}[m[3]]
        def dice(formula):
            if 'к'not in formula:return {'v':formula,'type':damage_type}
            count,die=formula.split('к');return {'v':formula.replace('к','d'),'type':damage_type,'count':int(count),'dice_id':'d'+die}
        d={'is_military':military,'is_long_range':ranged,'attacks':[dice(m[2])],'weight':fraction(facts[2]),'cost':{'value':int(facts[3]),'suggest_id':CURRENCIES[facts[4]]},'available_in_starting_shop':True,
           'mastery':facts[1],'notes':f'<p>Свойства: {properties}. Искусность: {facts[1]}. Для использования искусности требуется соответствующее умение.</p>',
           'required_weapon_proficiencies':copy.deepcopy(old['data'].get('required_weapon_proficiencies',[27 if military else 14]))if old else [27 if military else 14],
           'tags':[v for k,v in tags.items()if k in properties.casefold()]}
        if ma:=re.search(r'дис\. (\d+)/(\d+)',properties):d.update(range_min=int(ma[1]),range_max=int(ma[2]))
        if ma:=re.search(r'Универсальное \((\d+к\d+)\)',properties):d['universe_attacks']=[dice(ma[1])]
        if military and 'Лёгкое' in properties:d['required_weapon_proficiencies'].append(ref('suggest:4:martial-light'))
        if military and 'Фехтовальное' in properties:d['required_weapon_proficiencies'].append(ref('suggest:4:martial-finesse'))
        record=catalogue.add('weapon',name,1,d,216,old,status='partial',note='Урон, свойства, цена, вес и искусность по PHB 2024. Условия и результат искусности применяются игроком по описанию.')
        d['notes']+=masteries[facts[1]]
        register(record)
    # Weight table contains whole lines and a handful of wrapped names.
    weight_source=unwrap(raw[223]).replace('Предмет Вес Стоимость','')
    weights={}
    for s in sections(pages,220,230):
        match=re.match(r'(.+?)\s*\(([^)]+)\)$',s['name'])
        if not match:continue
        name,cost=match.groups();body=flat(s['blocks']);is_tool=s['page']<=222
        type_id=14 if is_tool else 10 if name=='Зелье лечения'else 2
        old=old_for(name,type_id)
        d={'desc':rich(s['blocks']),'available_in_starting_shop':True}
        if old:
            for field in ['category','equipment_category','required_tool_proficiencies','is_container','rarity','measurement','unit_cost_copper','unit_weight']:
                if field in old['data']:d[field]=copy.deepcopy(old['data'][field])
        price=re.fullmatch(r'([\d ]+)\s+(ЗМ|СМ|ММ)',cost)
        if price:d['cost']={'value':int(price[1].replace(' ','')),'suggest_id':CURRENCIES[price[2]]}
        else:d['available_in_starting_shop']=False
        weight=re.search(re.escape(name)+r'\s+([0-9/ ]+)\s+фнт',weight_source)
        if weight:d['weight']=fraction(weight[1].strip())
        elif is_tool and old:d['weight']=old['data'].get('weight',0)
        else:d['weight']=0
        if name=='Фляга':d['cost']={'value':2,'suggest_id':1} # Equipment table p.223; the paragraph has a currency typo.
        if name=='Верёвка':d.pop('measurement',None);d.pop('unit_cost_copper',None);d.pop('unit_weight',None)
        r=catalogue.add('tool'if is_tool else'gear',name,type_id,d,s['page'],old)
        register(r)
        if old:byname[norm(old['name'])]=ref(r['key'])
        if name=='Зелье лечения':
            # Full usable/action schema is intentionally supplied below by
            # the reviewed potion override, not inherited from its action version.
            d.update(consumable=True,usable={'healing':'2d4 + 2','concentration':False})
            r['automationStatus']='full';r['automationNote']='Лечение 2к4 + 2, ограничение максимальными хитами и расход дозы. Выпить или влить зелье — бонусное действие по описанию PHB 2024.'
    # Individual instruments, gaming sets, foci and ammunition have the same
    # physical facts; attach updated general use text where tools changed.
    for i in catalogue.items:
        n=norm(i['name'])
        if n in byname:continue
        tool=i['type_id']==14 and i['data'].get('category')in ['musical','gaming']
        names=['Стрела','Игла для духовой трубки','Арбалетный болт','Снаряд для пращи','Стрелы','Болты','Пули для пращи','Иглы для духовой трубки','Книга заклинаний','Амулет','Эмблема','Реликварий','Сфера','Кристалл','Жезл','Волшебная палочка','Веточка омелы','Деревянный посох','Тотем']
        extras=i['type_id']==2 and (i['name']in names or any(n.startswith(norm(x)+' (')for x in names))
        if (tool or extras) and 'по выбору' not in i['name']:
            d=copy.deepcopy(i['data']);d.pop('contents',None)
            if tool:d['desc']='<p>PHB 2024: владение инструментом даёт бонус владения к проверке с ним. При наличии владения подходящим навыком проверка получает преимущество.</p>'+d.get('desc','')
            r=catalogue.add('tool'if tool else'gear',i['name'],i['type_id'],d,222 if tool else 228,i,status='partial',note='Физические параметры и ссылка на конкретный предмет. Проверки применения выполняются по правилам 2024.')
            register(r)
            # Ammunition is bought per published package; inventory count uses
            # the same package convention as the existing shop.
            for x in names:
                if n.startswith(norm(x)+' ('):byname.setdefault(norm(x),ref(r['key']))
    byname[norm('Стрелы')]=byname[norm('Стрела')]
    for label,categories in [('music',['musical']),('gaming',['gaming']),('artisan',['artisan']),('artisan_music',['artisan','musical'])]:
        items=[r for r in catalogue.records if r['typeId']==14 and r['data'].get('category')in categories and r['data'].get('available_in_starting_shop') and r['data'].get('cost')]
        sets[label]={'names':[r['name']for r in items],'ids':[ref(r['key'])for r in items],'proficiencyIds':[next(x for x in r['data']['required_tool_proficiencies'] if x not in [22,25,26]) for r in items]}
    catalogue.decisions.extend({'id':i,'status':'compatible','note':'PHB 2024, таблица доспехов, стр. 219: параметры доспеха совпадают; общие правила надевания определяются редакцией.'}for i in shared)
    return gear,sets
