"""Reviewed 2014 catalogue corrections; no scraped prose is bundled here."""
import re, json, html
from urllib.parse import quote, unquote

def die(formula, label=''):
    payload={'formula':formula}
    if label: payload['label']=label
    encoded=quote(json.dumps(payload,ensure_ascii=False,separators=(',',':')),safe='')
    return f'<span data-rich-node="dice" data-rich-payload="{encoded}" contenteditable="false">{html.escape(formula.replace("d","к"))}</span>'

def rich(text):
    return re.sub(r'\b\d+[кd]\d+(?:\s*\+\s*\d+)?',lambda m:die(m[0].replace('к','d')),html.escape(text))

def paragraph(text):return '<p>'+rich(text)+'</p>'

def replace_die(text, old, new):
    def replace(m):
        payload=json.loads(unquote(m[1]));formula=payload.get('formula','').replace('к','d')
        if formula!=old:return m[0]
        return die(new,payload.get('label',''))
    return re.sub(r'<span[^>]*data-rich-node="dice"[^>]*data-rich-payload="([^"]+)"[^>]*>.*?</span>',replace,text)

APPEND={
648:'При успешном спасброске существо получает половину урона, остаётся на месте и не падает ничком.',
1234:'Если выбранное место занято существом, врата не создаются. Порталы — плоские вертикальные кольца над землёй; проход действует только с выбранной стороны. Через него существа и предметы сразу оказываются у второго кольца. Обратная сторона не переносит. Непрозрачный туман закрывает обзор. Бонусным действием в свой ход можно развернуть рабочие стороны обоих порталов.',
1400:'Сопряжение: одно видимое существо получает помеху на спасбросок против вашего заклинания очарования или иллюзии. Затмение: для некротического урона заклинания до 5-го круга можно перебросить число костей до модификатора Интеллекта (минимум одну); новые результаты обязательны. Сверхновая: одно заклинание прорицания считается применённым ячейкой на круг старше потраченной.',
4256:'Каждое дальнейшее применение до продолжительного отдыха добавляет ещё 1к12 некротического урона за круг заклинания. Этот урон игнорирует сопротивление и иммунитет.',
4065:'Дополнительное лечение даётся только тому, кто потратил хотя бы одну кость хитов во время этого короткого отдыха.',
}
MAMMON=[
'Возникает воронка пепла с руками из расплавленного металла: глубина 20 футов, диаметр 50 футов; внутри труднопроходимая местность.',
'При появлении воронки и в начале своего хода внутри неё существо получает 10к6 урона огнём. Оно выбирает спасбросок Силы или Ловкости; провал означает захват руками.',
'В начале вашего хода схваченное существо делает спасбросок Силы. При провале его затягивает на 5 футов в пепел. Погребённое существо ослеплено, оглохло и не может дышать.',
'Действием можно проверить Силу или Ловкость против Сл ваших заклинаний: успех освобождает из пепла. Существо может двигаться по воронке; до следующего своего хода повторно избегать захвата ему не нужно.',
'В начале каждого вашего хода диаметр увеличивается на 10 футов. После завершения заклинания руки исчезают и освобождают пленников, но яма остаётся. Остывающий пепел ещё час причиняет 1к6 урона огнём.',
]

def correct(item):
    id=item['id'];d=item['data'];key='description' if item['typeId']==5 else 'desc'
    desc=d.get(key,'')
    if id in APPEND:desc+=paragraph(APPEND[id])
    if id in [633,916,1041,1154]:
        desc=re.sub(r'(<span[^>]*data-rich-node="dice"[^>]*>.*?</span>)',r'\1 + модификатор базовой характеристики',desc,count=1)
    if id==590:desc=replace_die(desc,'d8','1d12')
    if id==1410:desc=replace_die(desc,'10d56','10d6')
    if id==696:desc=desc.replace('до начала его следующего хода','до конца её следующего хода')
    if id==808:desc=desc.replace('может уронить','роняет')
    if id==1130:desc=re.sub(r'<p>В конце каждого своего хода цель должна совершать спасбросок <span class="saving_throw">Телосложения</span>\.</p>', '', desc)
    if id==1237:desc=desc.replace('в воздух в выбранном вами направлении','на 40 футов в выбранном вами направлении')
    if id==1388:desc=''.join(paragraph(s) for s in MAMMON)
    if id==1392:desc=desc.replace('становится постоянным','длится до рассеивания',1)
    if id==1411:desc=desc.replace('радиусом до 40','радиусом до 20')
    if id==1187:
        races=[('01–04','Драконорождённый'),('05–13','Холмовой дварф'),('14–21','Горный дварф'),('22–25','Тёмный эльф'),('26–34','Высший эльф'),('35–42','Лесной эльф'),('43–46','Лесной гном'),('47–52','Скальный гном'),('53–56','Полуэльф'),('57–60','Полуорк'),('61–68','Легконогий полурослик'),('69–76','Коренастый полурослик'),('77–96','Человек'),('97–00','Тифлинг')]
        table='<table><thead><tr><th>к100</th><th>Раса</th></tr></thead><tbody>'+''.join(f'<tr><td>{a}</td><td>{b}</td></tr>'for a,b in races)+'</tbody></table>'
        desc=re.sub(r'<table\b.*?</table>',table,desc,flags=re.S)
    if id==4049:
        desc=desc.replace('2к6 урона','урон, зависящий от уровня персонажа: 2к6 на 1–5-м, 3к6 на 6–10-м, 4к6 на 11–15-м и 5к6 начиная с 16-го уровня')
        desc+=paragraph('Сл спасброска = 8 + бонус мастерства + модификатор Телосложения. Кислота и электричество: линия 30 × 5 футов, спасбросок Ловкости. Огонь латунного предка: такая же линия; золотого и красного — конус 15 футов, спасбросок Ловкости. Яд и холод: конус 15 футов, спасбросок Телосложения.')
        d['scaling']=[{'level':level,'value':f'{count}к6'}for level,count in [(1,2),(6,3),(11,4),(16,5)]]
    if id==67:
        d.update(level=20,level_source='class',level_class_id=4015,class_ids=[{'id':4015}])
    if id in [4285,4206,4193]:
        for action in d.get('feature_actions',[]):
            action['description']=paragraph(action['description'])
            if id==4285:action['description']+=paragraph('Цель совершает спасбросок Ловкости против Сл ваших заклинаний жреца: при успехе получает половину урона.')
    if id==1443:

        for a in d.get('feature_actions',[]):
            if a['key']=='hellish_rebuke':a['description']=replace_die(a['description'],'2d10{огонь}','3d10{огонь}')
    if desc:d[key]=desc
    if id in [494,497]:
        for k in ['dices','addon']:
            for row in d['damage'][k]:row['dice_id']='d8'
    if id in [469,633,702,848,1041]:d['damage']['add_mod']=True
    if id in [702,718,802,848,940]:d['damage']['scaling_step']=2
    if id==567:d['damage']['scaling_max_steps']=5
    if id==1152:d['heal']['scaling_max_steps']=1
    if id==648:d['damage']['save_effect']='half'
    if id in [751,1130,1333]:d.setdefault('damage',{})['range_attack']=True
    if id in [1371,1396,1415]:d['concentration']=True
    if id in [971,1353]:d['concentration']=False
    if id==1358:d['lvl']=9
    if id==1314:d['lvl']=3
    if id in [1026,1128]:d['time']='1 действие'
    if id==1254:d['heal']={'dices':[{'bonus':70}],'addon':[{'bonus':10}],'scaling':'slot'}
    if id==1401:d['heal']={'dices':[{'bonus':700}],'scaling':'none'}
