"""Named invocations and condition versions, with explicit source boundaries."""
import copy,re
from content_common import flat,key,ref,rich,sections

CONDITIONS={'Бессознательный':'unconscious','Недееспособный':'incapacitated','Оглохший':'deafened','Схваченный':'grappled','Испуганный':'frightened','Невидимый':'invisible','Очарованный':'charmed','Опутанный':'restrained','Окаменевший':'petrified','Отравленный':'poisoned','Парализованный':'paralyzed','Сбитый с ног':'prone','Ослеплённый':'blinded','Ошеломлённый':'stunned','Истощённый':'exhaustion','Героическое вдохновение':'inspiration'}

def conditions(pages,catalogue):
    for s in sections(pages,361,381):
        name=s['name'].split(' [')[0];code=CONDITIONS.get(name)
        if not code:continue
        old=next(i for i in catalogue.items if i['type_id']==15 and i['data'].get('code')==code)
        d={k:copy.deepcopy(old['data'][k]) for k in ['code','color','duration','polarity','stacking','level','max_level'] if k in old['data']}
        d['desc']=rich(s['blocks'])
        r=catalogue.add('condition',name,15,d,s['page'],old)
        if code=='exhaustion':r['automationStatus']='partial';r['automationNote']='Профиль 2024 применяет −2 к Тестам к20 и −5 футов скорости за уровень. Шесть уровней означают смерть; игровое состояние проверяет игрок.'
    if len([r for r in catalogue.records if r['typeId']==15])!=16:raise ValueError('Missing core conditions')

def invocations(pages,catalogue):
    parent=next(r for r in catalogue.records if r['key']==key('class-feature','Колдун:base:1:Таинственные воззвания'))
    parent['data']['ability_selection']={'counts':[{'level':l,'count':c} for l,c in [(1,1),(2,3),(5,5),(7,6),(9,7),(12,8),(15,9),(18,10)]],'replace_count':1}
    options=[s for s in sections(pages,115,118) if not re.match(r'^\d+',s['name'])]
    if len(options)!=28:raise ValueError('Expected 28 invocations')
    for s in options:
        name=s['name'];text=flat(s['blocks']);minimum=re.search(r'Колдун (\d+)',text)
        d={'desc':rich(s['blocks']),'selection_parent_id':ref(parent['key']),'level':int(minimum[1]) if minimum else 1,'level_source':'class','level_class_id':ref(key('class','Колдун')),'class_ids':[{'id':ref(key('class','Колдун'))}]}
        requirements=re.findall(r'воззвание (Договор (?:гримуара|клинка|цепи)|Жаждущий клинок)',text.split('\n')[0])
        if requirements:d['selection_requirements']={'abilities':[{'id':ref(key('invocation',v)),'name':v} for v in requirements]}
        if name in ['Мучительный взрыв','Мистическое копьё','Отталкивающий заряд']:
            d['choices']=[{'key':'cantrip','text':'Известный заговор Колдуна, удовлетворяющий условиям в описании','source':'item','from_item_type_id':5,'count':1,'item_filter':{'lvl':0,'classes.id':ref(key('class','Колдун'))}}]
        catalogue.add('invocation',name,4,d,s['page'],catalogue.original(name,4))

def metamagic(pages,catalogue):
    parent=next(r for r in catalogue.records if r['key']==key('class-feature','Чародей:base:2:Метамагия'))
    parent['data']['ability_selection']={'counts':[{'level':l,'count':c}for l,c in [(2,2),(10,4),(17,6)]],'replace_count':1}
    options=[s for s in sections(pages,165,167)if not re.match(r'^\d+',s['name'])]
    if len(options)!=10:raise ValueError('Expected 10 metamagic options')
    for s in options:
        d={'desc':rich(s['blocks']),'selection_parent_id':ref(parent['key']),'level':2,'level_source':'class','level_class_id':ref(key('class','Чародей')),'class_ids':[{'id':ref(key('class','Чародей'))}]}
        catalogue.add('metamagic',s['name'],4,d,s['page'],catalogue.original(s['name'],4))

def maneuvers(pages,catalogue):
    parent=next(r for r in catalogue.records if r['key']==key('class-feature','Воин:Мастер боя:3:Боевое превосходство'))
    parent['data']['ability_selection']={'counts':[{'level':l,'count':c}for l,c in [(3,3),(7,5),(10,7),(15,9)]],'replace_count':1,'replace_levels':[7,10,15]}
    section=next(s for s in sections(pages,72,74)if s['name']=='Варианты приёмов')
    text=flat(section['blocks'])
    names=['Активное уклонение','Атака с выпадом','Атака с манёвром','Атака с угрозой','Атака с финтом','Засада','Командирский напор','Обезоруживающая атака','Опрокидывающая атака','Ответный удар','Отвлекающий удар','Парирование','Подмена','Провоцирующая атака','Сплочение','Тактическая оценка','Толкающая атака','Точная атака','Удар командующего','Широкая атака']
    for index,name in enumerate(names):
        body=text.split(name+'. ',1)[1].split(names[index+1]+'. ',1)[0]if index+1<len(names)else text.split(name+'. ',1)[1]
        d={'desc':rich([{'text':body}]),'selection_parent_id':ref(parent['key']),'level':3,'level_source':'class','level_class_id':ref(key('class','Воин')),'class_ids':[{'id':ref(key('class','Воин'))}],'subclass_ids':[{'id':ref(key('subclass','Мастер боя'))}]}
        catalogue.add('maneuver',name,4,d,section['page'],catalogue.original(name,4))
