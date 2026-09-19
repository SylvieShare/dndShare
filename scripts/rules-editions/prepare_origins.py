"""Origin rules, feat categories and explicit choices from the supplied PHB."""
import copy,html,re
from content_common import flat,key,norm,ref,rich,sections,unwrap
from aliases import FEATS
ABILITIES={'Сил':1,'Ловк':2,'Телослож':3,'Интеллект':4,'Мудрост':5,'Харизм':6}
ABILITY_LABELS={1:'Сила',2:'Ловкость',3:'Телосложение',4:'Интеллект',5:'Мудрость',6:'Харизма'}
SKILLS={'Атлетика':1,'Акробатика':2,'Скрытность':3,'Ловкость рук':4,'Тайная магия':5,'История':6,'Природа':7,'Религия':8,'Расследование':9,'Восприятие':10,'Медицина':11,'Выживание':12,'Уход за животными':13,'Проницательность':14,'Обман':15,'Убеждение':16,'Выступление':17,'Запугивание':18}
BACKGROUNDS=[('Артист','Благородный'),('Бродяга','Моряк'),('Мудрец','Отшельник'),('Писарь','Преступник'),('Прислужник','Проводник'),('Ремесленник','Солдат'),('Стражник','Торговец'),('Фермер','Шарлатан')]
BG_EN={'Артист':'Entertainer','Благородный':'Noble','Бродяга':'Wayfarer','Моряк':'Sailor','Мудрец':'Sage','Отшельник':'Hermit','Писарь':'Scribe','Преступник':'Criminal','Прислужник':'Acolyte','Проводник':'Guide','Ремесленник':'Artisan','Солдат':'Soldier','Стражник':'Guard','Торговец':'Merchant','Фермер':'Farmer','Шарлатан':'Charlatan'}
# Starter kits were checked against the 16 background entries, pp.178–185.
BG_KITS={
 'Артист':(11,[('Костюм',2),('Зеркало',1),('Духи',1),('Дорожная одежда',1)],'music'),
 'Благородный':(29,[('Отличная одежда',1),('Духи',1)],'gaming'),
 'Бродяга':(16,[('Кинжал',2),('Воровские инструменты',1),('Игровой набор',1),('Спальник',1),('Кошель',2),('Дорожная одежда',1)],None),
 'Моряк':(20,[('Кинжал',1),('Инструменты навигатора',1),('Верёвка',1),('Дорожная одежда',1)],None),
 'Мудрец':(8,[('Боевой посох',1),('Инструменты каллиграфа',1),('Книга',1),('Пергамент',8),('Мантия',1)],None),
 'Отшельник':(16,[('Боевой посох',1),('Набор травника',1),('Спальник',1),('Книга',1),('Лампа',1),('Масло',3),('Дорожная одежда',1)],None),
 'Писарь':(23,[('Инструменты каллиграфа',1),('Отличная одежда',1),('Лампа',1),('Масло',3),('Пергамент',12)],None),
 'Преступник':(16,[('Кинжал',2),('Воровские инструменты',1),('Ломик',1),('Кошель',2),('Дорожная одежда',1)],None),
 'Прислужник':(8,[('Инструменты каллиграфа',1),('Книга',1),('Священный символ',1),('Пергамент',10),('Мантия',1)],None),
 'Проводник':(3,[('Короткий лук',1),('Стрелы',20),('Инструменты картографа',1),('Спальник',1),('Колчан',1),('Палатка',1),('Дорожная одежда',1)],None),
 'Ремесленник':(32,[('Кошель',2),('Дорожная одежда',1)],'artisan'),
 'Солдат':(14,[('Копьё',1),('Короткий лук',1),('Стрелы',20),('Комплект целителя',1),('Колчан',1),('Дорожная одежда',1)],None),
 'Стражник':(12,[('Копьё',1),('Лёгкий арбалет',1),('Арбалетный болт',20),('Игровой набор',1),('Фонарь, закрытый',1),('Кандалы',1),('Колчан',1),('Дорожная одежда',1)],None),
 'Торговец':(22,[('Инструменты навигатора',1),('Кошель',2),('Дорожная одежда',1)],None),
 'Фермер':(30,[('Серп',1),('Инструменты плотника',1),('Комплект целителя',1),('Горшок, железный',1),('Лопата',1),('Дорожная одежда',1)],None),
 'Шарлатан':(15,[('Набор для фальсификации',1),('Костюм',1),('Отличная одежда',1)],None),
}

def feat_choice(abilities,bonus=1):
    return {'key':'ability','text':f'Увеличьте характеристику на {bonus}','source':'inline','count':1,'ability_bonus':bonus,'options':[{'value':a,'label':ABILITY_LABELS[a]}for a in abilities]}

def feats(pages,catalogue,tool_sets):
    records=sections(pages,200,212)
    if len(records)!=75:raise ValueError('Expected 75 feats, got '+str(len(records)))
    for s in records:
        text=flat(s['blocks']);name=s['name'];old=catalogue.original(name,7,FEATS.get(name))
        category='origin'if text.startswith('Черта происхождения')else'fighting_style'if text.startswith('Черта Боевого стиля')else'epic_boon'if text.startswith('Черта Эпического дара')else'general'
        d={'description':rich(s['blocks']),'category':category,'level_source':'bound'}
        prereq=re.search(r'Требования:\s*([^)]*)\)',text)
        if prereq:
            d['prereq']={'text':prereq[1]}
            if m:=re.search(r'уровень (\d+)\+',prereq[1]):d['prereq']['min_level']=int(m[1])
            if 'Сотворение заклинаний'in prereq[1]or'Магия договора'in prereq[1]:d['prereq']['spellcasting']=True
            stat_ids=[i for stem,i in ABILITIES.items()if stem in prereq[1]]
            if stat_ids and '13+'in prereq[1]:d['prereq'].update(min_stats=[{'ability':a,'value':13}for a in stat_ids],min_stats_mode='any'if' или 'in prereq[1]else'all')
        asi=re.search(r'Повышение характеристики\. (.*?)(?:20|30)\.',text)
        if asi and 'на 1'in asi[1]:
            ids=[i for stem,i in ABILITIES.items()if stem in asi[1]]or list(range(1,7))
            d['choices']=[feat_choice(ids)]
        if 'Повторное получение'in text:d['repeatable']=True
        r=catalogue.add('feat',name,7,d,s['page'],old)
        if name in ['Крепкий','Одарённый']:
            for field in ['choices','derived_effects','hp_bonuses']:
                if field in old['data']:d[field]=copy.deepcopy(old['data'][field])
            r['automationStatus']='full';r['automationNote']='Проверенный неизменившийся расчёт и обязательные выборы.'
        if name=='Бдительный':
            d['derived_effects']=[{'kind':'check_bonus','proficiency_multiplier':1,'scopes':['initiative']}]
            r['automationStatus']='partial';r['automationNote']='Бонус владения к инициативе. Обмен инициативой с согласным союзником выполняется вручную.'
        if name=='Везунчик':
            d.update(max_use_scaling=True,rollback_long_rest=True,scaling=[{'level':l,'uses':n}for l,n in [(1,2),(5,3),(9,4),(13,5),(17,6)]])
        if name in ['Музыкант','Самоделкин']:
            label='music'if name=='Музыкант'else'artisan'
            d['choices']=[{'key':'tools','text':'Выберите три инструмента','source':'inline','count':3,'options':[{'label':n,'value':i}for n,i in zip(tool_sets[label]['names'],tool_sets[label]['proficiencyIds'])]}]
            d['derived_effects']=[{'kind':'tool_proficiency','choice_key':'tools','target_from_choice':True}]
        if name=='Устойчивый':
            d['choices']=[feat_choice(list(range(1,7)))];d['derived_effects']=[{'kind':'save_proficiency','choice_key':'ability','target_from_choice':True}]
        if name=='Посвящённый в магию':
            d['choices']=[{'key':'magic_class','text':'Список заклинаний','source':'inline','count':1,'options':[{'label':n,'value':ref(key('class',n))}for n in ['Волшебник','Друид','Жрец']]},
              {'key':'casting_ability','text':'Характеристика заклинаний','source':'inline','count':1,'options':[{'label':ABILITY_LABELS[a],'value':a,'casting_ability':a}for a in [4,5,6]]}]
            for field,count,level in [('cantrips',2,0),('spell',1,1)]:
                d['choices'].append({'key':field,'text':'Заговоры'if level==0 else'Заклинание 1 уровня','source':'item','count':count,'from_item_type_id':5,'grant_spells':True,'item_filter':{'lvl':level},'depends_on_choice':'magic_class','item_filter_from_choice':{'path':'classes.id','choice_key':'magic_class'},'casting_ability_choice_key':'casting_ability',**({'slotless':True,'cast_level':1}if level else{})})
            d.update(max_use=1,rollback_long_rest=True)
            r['automationStatus']='partial';r['automationNote']='Выбор класса и характеристики, два заговора и заклинание 1 уровня. Замена заклинания при повышении настраивается в выборе черты.'


def backgrounds(raw,catalogue,gear,tool_sets,metadata):
    suggestions={norm(s['value']):s['id']for s in metadata['suggests']if s['type_id']==5}
    for page,names in enumerate(BACKGROUNDS,178):
        bodies=re.split(r'Значения характеристик:\s*',raw[page])[1:]
        if len(bodies)!=2:raise ValueError('Expected two backgrounds')
        for index,name in enumerate(names):
            body=unwrap(bodies[index]);stats=body.split('Черта:',1)[0]
            ids=[i for stem,i in ABILITIES.items()if stem in stats]
            feat=re.search(r'Черта: (.*?) \(см\.',body)[1]
            fixed_class=re.search(r'Посвящённый в магию \(([^)]+)\)',feat)
            if fixed_class:feat='Посвящённый в магию'
            skills=re.search(r'Владение навыками: (.*?) Владение инструментами:',body)[1]
            tool=re.search(r'Владение инструментами: (.*?) Снаряжение:',body)[1]
            d={'ability_options':ids,'origin_feat_id':ref(key('feat',feat)),'skills':[i for n,i in SKILLS.items()if n in skills], 'starting_gold':50,'description':'<p>'+html.escape(body)+'</p>'}
            if fixed_class:d['origin_feat_class_id']=ref(key('class',fixed_class[1]))
            # Last-page labels are outside the body; remove them explicitly.
            for n in names:d['description']=d['description'].replace(n+'</p>','</p>')
            gold,items,choice=BG_KITS[name]
            d['starting_coins']=[{'currency_id':3,'amount':gold}]
            if 'выберите'in tool.casefold():
                choice='music'if'Музыкальн'in tool else'gaming'if'Игров'in tool else'artisan'
                d['item_choices']=[{'key':'tool','label':tool,'option_item_ids':tool_sets[choice]['ids'],'grants_equipment_item':True,'grants_tool_proficiency':True}]
            elif norm(tool)in suggestions:d['tool_prof']=[suggestions[norm(tool)]]
            else:raise ValueError('Unknown background tool '+tool)
            d['equipment_items']=[{'item_id':gear(n),'count':count}for n,count in items if n!='Игровой набор']
            if any(n=='Игровой набор'for n,_ in items) and choice!='gaming':
                d.setdefault('item_choices',[]).append({'key':'game','label':'Игровой набор','option_item_ids':tool_sets['gaming']['ids'],'grants_equipment_item':True})
            catalogue.add('background',name,11,d,page+1,catalogue.original(name,11,BG_EN[name]),status='partial',note='Бонусы характеристик, черта происхождения, навыки, инструменты и стартовое снаряжение; выбор варианта А или 50 зм.')


def species(pages,catalogue):
    records=sections(pages,186,198,15)
    if len(records)!=10:raise ValueError('Expected 10 species')
    for s in records:
        name=s['name'];text=flat(s['blocks']);speed=re.search(r'Скорость: (\d+)',text)
        if not speed:raise ValueError('Missing species speed '+name)
        size='Маленький'if name in ['Гном','Полурослик']else'Средний'
        # Standard PHB 2024 languages are a character creation choice, no longer
        # determined by species. Common and two standard languages are granted.
        d={'description':rich(s['blocks']),'speed':int(speed[1]),'size':size,'languages':[22],'lang_choice':{'count':2,'from':[19,20,25,26,39,40,52,55,ref('suggest:6:common-sign')]}}
        lineages={'Гном':['Лесной гном','Скальный гном'],'Голиаф':['Облачный великан','Огненный великан','Ледяной великан','Холмовой великан','Каменный великан','Штормовой великан'],'Драконорождённый':['Чёрный','Синий','Латунный','Бронзовый','Медный','Золотой','Зелёный','Красный','Серебряный','Белый'],'Тифлинг':['Наследие Бездны','Хтоническое наследие','Инфернальное наследие'],'Эльф':['Дроу','Высший эльф','Лесной эльф']}
        variants=lineages.get(name,[])
        sizes=['Маленький','Средний']if 'или Маленький'in text else [size]
        if variants or len(sizes)>1:d['variants']=[{'value':(variant+':'+sz)if len(sizes)>1 else variant,'label':(variant+' — '+sz)if variant and len(sizes)>1 else variant or sz,'size':sz,**({'speed':35}if variant=='Лесной эльф'else {})}for variant in variants or ['']for sz in sizes]
        if name in ['Эльф','Тифлинг','Драконорождённый']:
            clean=[b for b in s['blocks']if b.get('size')!=8 and not(b['kind']=='heading'and b.get('size')==10)]
            d['description']=rich(clean)
            tables={'Эльф':['Дроу: Тёмное зрение 120 футов, Пляшущие огоньки; уровень 3 — Огонь фей; уровень 5 — Тьма.','Высший эльф: Фокусы (можно заменить заговором Волшебника после Долгого отдыха); уровень 3 — Обнаружение магии; уровень 5 — Туманный шаг.','Лесной эльф: скорость 35 футов, Искусство друидов; уровень 3 — Скороход; уровень 5 — Бесследное передвижение.'], 'Тифлинг':['Наследие Бездны: сопротивление Яду, Ядовитые брызги; уровень 3 — Луч болезни; уровень 5 — Удержание личности.','Хтоническое наследие: сопротивление Некротической энергии, Леденящее прикосновение; уровень 3 — Псевдожизнь; уровень 5 — Луч слабости.','Инфернальное наследие: сопротивление Огню, Огненный снаряд; уровень 3 — Адское возмездие; уровень 5 — Тьма.'], 'Драконорождённый':['Чёрный и Медный — Кислота; Синий и Бронзовый — Электричество; Латунный, Золотой и Красный — Огонь; Зелёный — Яд; Серебряный и Белый — Холод.']}
            d['description']+='<h3>Происхождение</h3>'+''.join('<p>'+v+'</p>'for v in tables[name])
        old=catalogue.original(name,8)
        r=catalogue.add('species',name,8,d,s['page'],old,status='partial',note='Скорость, размер, языки и выбор происхождения. Прочие особенности вида описаны в отдельной способности.')
        if name=='Человек':d.update(skill_choice={'count':1,'from':[]},feat_choice={'count':1})
        if name=='Эльф':d['skill_choice']={'count':1,'from':[10,14,12]}
        if name=='Дварф':d['speed']=30
        ability=catalogue.add('species-feature',name,3,{'desc':d['description'],'race_ids':[{'id':ref(r['key'])}],'level':1,'level_source':'bound'},s['page'])
        ability['name']='Особенности вида: '+name
        if name in ['Эльф','Гном','Тифлинг']:
            ability['data']['choices']=[{'key':'casting_ability','text':'Заклинательная характеристика вида','source':'inline','count':1,'options':[{'value':i,'label':ABILITY_LABELS[i]}for i in [4,5,6]]}]
        if name=='Дварф':
            ability['data']['hp_bonuses']=[{'title':'Дварфская стойкость','per_level':1}]
            ability['automationStatus']='partial';ability['automationNote']='Дварфская стойкость добавляет 1 хит за уровень. Остальные особенности — по описанию.'
