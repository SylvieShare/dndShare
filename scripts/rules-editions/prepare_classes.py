"""2024 classes, their 48 subclasses, and level-bound feature descriptions."""
import copy,re
from content_common import flat,key,ref,rich,unwrap
from aliases import SUBCLASSES

CLASSES=[('Бард',51,60),('Варвар',61,68),('Воин',69,78),('Волшебник',79,90),('Друид',91,102),('Жрец',103,112),('Колдун',113,124),('Монах',125,132),('Паладин',133,142),('Плут',143,152),('Следопыт',153,162),('Чародей',163,175)]
SPELL_CLASSES={'Бард':(6,'full','known'),'Волшебник':(4,'full','spellbook'),'Друид':(5,'full','prepared'),'Жрец':(5,'full','prepared'),'Колдун':(6,'pact','known'),'Паладин':(6,'halfup','prepared'),'Следопыт':(5,'halfup','prepared'),'Чародей':(6,'full','known')}
SKILLS={'Бард':list(range(1,19)),'Воин':[2,1,10,12,18,6,14,16,13],'Волшебник':[6,11,7,14,9,8,5],'Друид':[10,12,11,7,14,8,5,13]}
KITS={
 'Бард':(90,19,[('Кожаный доспех',1),('Кинжал',2),('Набор артиста',1)],'music'),
 'Варвар':(75,15,[('Секира',1),('Одноручный топор',4),('Набор исследователя подземелий',1)],None),
 'Воин':(155,4,[('Кольчуга',1),('Двуручный меч',1),('Цеп',1),('Метательное копьё',8),('Набор исследователя подземелий',1)],None),
 'Волшебник':(55,5,[('Кинжал',2),('Боевой посох',1),('Мантия',1),('Книга заклинаний',1),('Набор учёного',1)],None),
 'Друид':(50,9,[('Кожаный доспех',1),('Щит',1),('Серп',1),('Боевой посох',1),('Набор путешественника',1),('Набор травника',1)],None),
 'Жрец':(110,7,[('Кольчужная рубаха',1),('Щит',1),('Булава',1),('Священный символ',1),('Набор священника',1)],None),
 'Колдун':(100,15,[('Кожаный доспех',1),('Серп',1),('Кинжал',2),('Сфера',1),('Книга',1),('Набор учёного',1)],None),
 'Монах':(50,11,[('Копьё',1),('Кинжал',5),('Набор исследователя подземелий',1)],'artisan_music'),
 'Паладин':(150,9,[('Кольчуга',1),('Щит',1),('Длинный меч',1),('Метательное копьё',6),('Священный символ',1),('Набор священника',1)],None),
 'Плут':(100,8,[('Кожаный доспех',1),('Кинжал',2),('Короткий меч',1),('Короткий лук',1),('Стрелы',20),('Колчан',1),('Воровские инструменты',1),('Набор взломщика',1)],None),
 'Следопыт':(150,7,[('Проклёпанный кожаный доспех',1),('Скимитар',1),('Короткий меч',1),('Длинный лук',1),('Стрелы',20),('Колчан',1),('Веточка омелы',1),('Набор путешественника',1)],None),
 'Чародей':(50,28,[('Копьё',1),('Кинжал',2),('Кристалл',1),('Набор исследователя подземелий',1)],None),
}

def progression(text,kind):
    matches=list(re.finditer(r'(?m)^(\d+) \+[2-6] ',text));rows=[]
    if len(matches)!=20:raise ValueError('Expected 20 progression rows')
    for index,m in enumerate(matches):
        segment=text[m.end():matches[index+1].start()if index+1<len(matches)else len(text)]
        count=5 if kind=='pact'else 7 if kind=='halfup'else 11
        values=re.search(r'(?<!\w)((?:\d+|—)(?:\s+(?:\d+|—)){'+str(count-1)+r',})(?!\w)',segment)
        if not values:raise ValueError('Cannot parse progression '+str(m[1]))
        nums=[int(v)if v!='—'else 0 for v in values[1].split()]
        cantrips,spells=(nums[-4],nums[-3])if kind=='pact'else (0,nums[-6])if kind=='halfup'else (nums[-11],nums[-10])
        rows.append({'level':int(m[1]),'cantrips':cantrips,'spells':spells})
    return rows

def prepare(pages,raw_pages,catalogue,gear,tool_sets):
    for name,start,end in CLASSES:
        old=catalogue.original(name,9)
        if not old:raise ValueError('Missing base class '+name)
        # Only explicitly checked unchanged base attributes are reused.
        d={k:copy.deepcopy(old['data'][k]) for k in ['hit_die','primary_abilities','saves','armor_prof','skill_choice','suggest_id','short_description','tool_prof','tool_prof_choice']if k in old['data']}
        d.update(subclass_level=3,asi_levels='4,8,12,16,19',weapon_prof=[14])
        if name=='Воин':d['asi_levels']='4,6,8,12,14,16,19'
        if name=='Плут':d['asi_levels']='4,8,10,12,16,19'
        if name in ['Варвар','Воин','Паладин','Следопыт']:d['weapon_prof']=[14,27]
        if name=='Друид':d['armor_prof']=[9,14]
        if name in ['Монах','Плут']:
            # Concrete proficiencies cover the PHB martial weapons meeting the
            # 2024 light/finesse rule; the description retains the full rule.
            d['weapon_prof']=[14,ref('suggest:4:martial-light')] + ([ref('suggest:4:martial-finesse')] if name=='Плут'else [])
        if name in SKILLS:d['skill_choice']={'count':3 if name=='Бард'else 2,'from':SKILLS[name]}
        if name in SPELL_CLASSES:
            ability,kind,mode=SPELL_CLASSES[name];rows=progression(raw_pages[start+1],kind)
            d['caster_progression']=kind
            d['spellcasting']={'ability':ability,'cantrips_known':rows[0]['cantrips'],'spells_known':6 if mode=='spellbook'else rows[0]['spells'],'prepares':mode in ['prepared','spellbook'],'selection_mode':mode,'known_progression':rows}
            if mode=='spellbook':
                d['spellcasting']['level_up_choices']=2
                d['spellcasting']['prepared_progression']=[{'level':r['level'],'count':r['spells']}for r in rows]
                d['spellcasting']['known_progression']=[{'level':r['level'],'cantrips':r['cantrips']}for r in rows]
        gold,kit_gold,items,pick=KITS[name]
        d['starting_gold']=gold
        def kit_items(rows):return [{'name':n,'item_id':gear(n),'count':count}for n,count in rows]
        d['starting_kit']={'gold':kit_gold,'fixed':kit_items(items),'groups':[],'fixedPicks':[]}
        if pick:d['starting_kit']['fixedPicks']=[{'id':'instrument','label':'Инструмент, которым вы владеете','count':1,'options':tool_sets[pick]['names']}]
        if name=='Воин':
            b=[('Проклёпанный кожаный доспех',1),('Скимитар',1),('Короткий меч',1),('Длинный лук',1),('Стрелы',20),('Колчан',1),('Набор исследователя подземелий',1)]
            d['starting_kit']={'gold':0,'fixed':[],'fixedPicks':[],'groups':[{'id':'kit','label':'Комплект воина','options':[{'id':'a','label':'А — тяжёлое снаряжение и 4 зм','items':kit_items(items),'gold':4},{'id':'b','label':'Б — лёгкое снаряжение и 11 зм','items':kit_items(b),'gold':11}]}]}
        intro=[]
        for b in pages[start]:
            if b['kind']=='heading'and b['text'].startswith('Выбор '):break
            intro.append(b)
        d['description']=rich(intro)
        cls=catalogue.add('class',name,9,d,start+1,old,status='partial',note='Базовые параметры, ячейки, выбор подкласса с 3 уровня и стартовое снаряжение по PHB 2024. Автоматизация отдельных умений отмечена в их карточках.')
        in_subclasses=False;sub=None;current=None;features=[];subrecords=[]
        def finish():
            nonlocal current
            if current:features.append(current);current=None
        for page in range(start,end):
            for b in pages[page]:
                title=unwrap(b['text'])
                if b['kind']=='heading'and b['size']>=15:
                    finish()
                    if title.startswith('Подклассы '):in_subclasses=True
                    elif in_subclasses and b['size']==15:
                        sd={'class':ref(cls['key']),'description':''}
                        sub=catalogue.add('subclass',title,17,sd,page+1,catalogue.original(title,17,SUBCLASSES.get(title)),cls['key'])
                        subrecords.append(sub)
                        if title in ['Мистический рыцарь','Мистический ловкач']:
                            sd['caster_progression']='third';sd['spellcasting']={'ability':4,'start_level':3,'cantrips_known':2,'spells_known':3,'selection_mode':'known','list_class':ref(key('class','Волшебник')),'known_progression':[{'level':l,'cantrips':2 if l<10 else 3,'spells':s}for l,s in [(3,3),(4,4),(7,5),(8,6),(10,7),(11,8),(13,9),(14,10),(16,11),(19,12),(20,13)]]}
                    continue
                if b['kind']=='heading'and title=='Варианты приёмов':finish();continue
                m=re.match(r'^(\d+)[-‑]й уровень:\s*(.*)',title)if b['kind']=='heading'else None
                if m:
                    finish()
                    if sub:sub['data']['description']+=rich([b])
                    current={'name':m[2],'level':int(m[1]),'page':page+1,'blocks':[],'sub':sub};continue
                if current:current['blocks'].append(b)
                if sub:sub['data']['description']+=rich([b])
        finish()
        if len(subrecords)!=4:raise ValueError(f'{name}: expected 4 subclasses, got {len(subrecords)}')
        for f in features:
            fd={'desc':rich(f['blocks']),'level':f['level'],'level_source':'class','level_class_id':ref(cls['key']),'class_ids':[{'id':ref(cls['key'])}]}
            if f['sub']:fd['subclass_ids']=[{'id':ref(f['sub']['key'])}]
            unique=f"{name}:{f['sub']['name']if f['sub']else 'base'}:{f['level']}:{f['name']}"
            ability=catalogue.add('class-feature',unique,4,fd,f['page'])
            ability['name']=f['name']
            if f['name']=='Искусное владение оружием':
                fd['choices']=[{'key':'mastery','text':'Оружие с освоенным свойством искусности','count':3 if name=='Воин'else 2,'source':'item','from_item_type_id':1}]
                ability['automationStatus']='partial';ability['automationNote']='Выбор оружия сохраняется на листе. Дополнительные свойства применяются по описанию; рост количества и замена после отдыха — в настройках умения.'
            # Identical, independently checked core calculations only.
            source_name='Скрытая атака'if f['name']=='Коварная атака'else f['name']
            candidates=[i for i in catalogue.items if i['type_id']==4 and i['name']==source_name and any(x.get('id')==old['id']for x in i['data'].get('class_ids',[])) and not i['data'].get('subclass_ids')]
            if not f['sub'] and f['name']in ['Защита без доспехов','Коварная атака','Дополнительная атака'] and len(candidates)==1:
                source=candidates[0]
                for k in ['derived_effects','weapon_damage','sheet_widgets','extra_attacks']:
                    if k in source['data']:fd[k]=copy.deepcopy(source['data'][k])
                ability['originalId']=source['id'];ability['automationStatus']='partial';ability['automationNote']='Проверенные базовые расчёты перенесены; условия применения — в описании PHB 2024.'
    return catalogue.records
