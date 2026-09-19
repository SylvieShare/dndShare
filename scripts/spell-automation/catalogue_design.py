#!/usr/bin/env python3
"""Reproducible coverage and design index. Suggestions never mutate live statuses.

Every catalogue record gets an entry. Text matches are review leads, not proof
that a mechanic is missing or that a spell is fully automated.
"""
import argparse, collections, csv, html, json, re
from pathlib import Path

FAMILIES = [
 ('shared_pool',r'распредел\w*.{0,100}(?:хит|урон)|(?:700|семьсот).{0,20}хит','Общий запас между целями','Один запас на castId, суммы назначений не превышают остаток; получатель принимает свою долю, отказ возвращает её в запас.'),
 ('hp_source',r'временн\w* хит|максимум.{0,20}хит|хитов.{0,20}(?:уменьша|увелич)','Хиты с источником','Временные и максимальные ХП хранить с sourceInstanceId. Не складывать временные ХП; при замене, окончании и уроне затрагивать только соответствующий источник.'),
 ('life_cycle',r'в начале.{0,50}ход|в конце.{0,50}ход|начинает.{0,20}ход|оканчивает.{0,20}ход|впервые.{0,20}ход|в конце.{0,20}дн','Повторные события','Один экземпляр действия на активном эффекте: начало/конец хода, вход в область, ручной триггер; один receipt на событие и цель. Простой повторный спасбросок уже есть.'),
 ('save_progress',r'тр[её]х спасброс|три спасброс|тр[её]х провал|три провал|успехи и провалы','Накопление результатов','Счётчики успехов и провалов на эффекте, пороги и переходы между эффектами; промежуточный успех не снимает состояние автоматически.'),
 ('conditions',r'очарован|испуган|парализ|ослеп|отравлен|ошеломл|оглуш[её]н|опутан|недееспособ|окамен|сбит.{0,5}ног|ничком','Условия и состояния','Типизированные теги состояний, иммунитеты до наложения, модификаторы броска на стороне действующего и цели, снятие/окончание по источнику. Одного текстового маркера недостаточно.'),
 ('cleansing',r'(?:заканчива|прекраща|снима|исцел|излеч|устран|очища).{0,100}(?:болез|проклят|состояни|слепот|глухот|очарова|парали)','Снятие эффектов','Выбрать существующий экземпляр по тегам и ограничениям источника; атомарно снять его и связанные модификаторы. Снятие проклятия с вещи отдельно от удаления самой вещи.'),
 ('linked_targets',r'каждый раз.{0,60}получает.{0,30}урон|такое же количество урона|столько же урона|зеркальн','Связь целей','Сохранённая пара источник–цель, общий проход применения фактического урона, защита от рекурсии, история обеих сторон; отмена связи по указанным условиям.'),
 ('weapon_overlay',r'атак\w* оружием|атак.{0,25}ваш.{0,10}оруж|оружие становится|боеприпас.{0,30}превращ|использует.{0,30}заклинательн','Изменение выбранного оружия','Выбор UID оружия и временный слой параметров/костей/типа с sourceInstanceId; дополнительные кости отдельно от основной атаки, крит и расход по событию попадания.'),
 ('summon',r'призыва.{0,100}(?:существ|дух|звер|элементал|небож|исчад)|созда[её]те.{0,80}существ|оживля|поднимается.{0,20}зомби','Подконтрольные существа','Создать NPC из шаблона справочника, сохранить владельца, исходное сотворение, усиление и срок. Команды/атаки используют обычный бой и события; лимит существ общий для сотворения.'),
 ('form',r'превращ.{0,80}(?:существ|звер|форм)|новой формы|форму.{0,30}существа','Превращение','Слой формы поверх листа с отдельными ХП и явным списком замещаемых характеристик; возврат исходного слоя без потери ресурсов, предметов и истории.'),
 ('item_creation',r'(?:созда[её]т|появля).{0,100}(?:ягод|эликсир|предмет|объект|пищ|вод|шарик|оруж|боеприпас)|изготовлен','Создание предмета','Справочная запись и item_creation с количеством, усилением, сроком и последствием окончания. Расходуемое применение через usable; свойства зависят от сохранённых параметров сотворения.'),
 ('random_branch',r'таблиц|случайным образом|случайно выбран|случайное направ|перебрасывая','Случайный результат','Декларативная таблица диапазонов и веток, сохранённый бросок и ручной выбор допустимого варианта. Каждая цель может иметь свою ветку; повтор запроса не перебрасывает результат.'),
 ('death',r'мгновенн.{0,20}смерт|цель умирает|заставляете умереть|до 0.{0,80}(?:хит|порош)|умирает.{0,30}хит|убивающ','Смерть и её предотвращение','Порог по текущим ХП и отдельный исход instantDeath; не подменять огромным уроном. До изменения применить иммунитеты/перехватчики, затем записать способ смерти и ограничения воскрешения.'),
 ('resource',r'заряд|использовани.{0,30}(?:раз|количеств)|(?:долг|длинн|коротк).{0,8}отдых|кост[ьи].{0,8}хит|костей хитов','Расходы и восстановление','Общий ресурсный интерфейс на источнике: максимум, остаток, восстановление, привязанные действия. Выдать отдых — отдельная транзакция, с индивидуальным cooldown до следующего отдыха.'),
 ('roll_modifiers',r'преимуществ|помех|бонус|штраф|вычитает.{0,15}к[468]|не может восстанавливать','Контекст броска/применения','Расширять общий контекст: вид броска, цель, состояние, концентрация, атака оружием. Флажки бонусов и предварительная формула — одни компоненты; ограничения проверяются при применении.'),
 ('exploding_dice',r'выпадет.{0,30}8.{0,120}дополнительно|максимальное количество.{0,60}к8','Взрывающиеся кости','Проверяемый сервером пул: исходные и добавленные кости, триггер по грани, общий лимит из сохранённого модификатора, тип урона и идемпотентный результат.'),
 ('scene',r'телепорт|план бытия|план существования|освещ|тускл.{0,8}свет|ярк.{0,8}свет|труднопроходим|иллюзи|территори|област|куб|конус|сфер','Сцена и геометрия','Мастер подтверждает область, видимость, дистанцию, свет и перемещение. Хранить контекст/заметку и выбранные цели; карты и координат не добавлять. Эта часть не снижает общий статус.'),
]

def plain(value):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',value or ''))).strip()
def index(spells,effects):
 by_effect={x['id']:x for x in effects};out=[];problems=[]
 for item in spells:
  d=item['data'];text=plain(d.get('description'));low=text.lower();implemented=[]
  damage=d.get('damage') or {};heal=d.get('heal') or {}
  for yes,label in [(damage.get('dices'),'Урон'),(damage.get('range_attack'),'Атака'),(damage.get('save_ability'),'Спасбросок'),(d.get('rolls'),'Отдельные этапы'),(heal.get('dices'),'Временные хиты' if heal.get('kind')=='temporary_hp' else 'Формула лечения' if heal.get('apply') is False else 'Применение лечения'),(d.get('status_effects'),'Связанные эффекты'),(damage.get('type_choices'),'Выбор типа урона'),(damage.get('roll_table'),'Тип по результату костей'),(damage.get('attack_chain'),'Серия атак'),(d.get('item_creation'),'Создание предметов')]:
   if yes:implemented.append(label)
  linked=[]
  for link in d.get('status_effects',[]):
   id=(link.get('effect') or {}).get('id') if isinstance(link.get('effect'),dict) else link.get('effect')
   effect=by_effect.get(id)
   if not effect:problems.append({'spell':item['id'],'kind':'missing_effect','effect':id});continue
   if effect['data'].get('repeat_save') and 'Повторный спасбросок' not in implemented:implemented.append('Повторный спасбросок')
   sources=effect['data'].get('application_sources',[])
   if not any((x.get('item') or {}).get('id')==item['id'] for x in sources if isinstance(x.get('item'),dict)):problems.append({'spell':item['id'],'kind':'missing_backlink','effect':id})
   linked.append(id)
  if d.get('concentration'):implemented.append('Концентрация и связанные эффекты')
  candidates=[]
  for key,pattern,title,proposal in FAMILIES:
   match=re.search(pattern,low)
   if not match:continue
   start=max(0,low.rfind('.',0,match.start())+1);end=low.find('.',match.end());end=len(text) if end<0 else end+1
   candidates.append({'key':key,'name':title,'evidence':text[start:min(end,start+500)].strip(),'proposal':proposal})
  if not candidates:candidates=[{'key':'narrative','name':'Решение по описанию','evidence':text[:300],'proposal':'Декларация сотворения, ресурс, выбранные цели и результат мастера в хронике. Не преобразовывать свободный текст в изменение листа без явного правила.'}]
  if not text:problems.append({'spell':item['id'],'kind':'missing_description'})
  if item.get('automationStatus') not in ['full','partial','none','unreviewed']:problems.append({'spell':item['id'],'kind':'invalid_status'})
  out.append({'id':item['id'],'name':item['name'],'edition':', '.join(str(c.get('version') or c['sourceVersionId']) for c in item.get('compatibility',[]) if c['status']=='native'),
   'level':d.get('lvl'),'status':item['automationStatus'],'assessment':item.get('automationNote',''),'implemented':implemented,'effects':linked,
   'sceneContext':any(x['key']=='scene' for x in candidates),'designCandidates':candidates,'review':'catalogue_full' if item['automationStatus']=='full' else 'proposal_requires_rule_review'})
 return out,problems

def main():
 p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('output');a=p.parse_args();root=Path(a.directory);target=Path(a.output);target.mkdir(parents=True,exist_ok=True)
 spells=json.loads((root/'after-5.json').read_text());effects=json.loads((root/'after-15.json').read_text());rows,problems=index(spells,effects)
 assert len(rows)==len({r['id'] for r in rows})==len(spells)
 summary={'spells':len(rows),'statuses':dict(collections.Counter(r['status'] for r in rows)),'editions':dict(collections.Counter(r['edition'] for r in rows)),
   'proposalFamilies':dict(collections.Counter(c['name'] for r in rows if r['status']!='full' for c in r['designCandidates'])),'structuralProblems':problems,
   'method':'Все записи включены. Предложения по текстовым признакам — направления разбора, не доказанные пробелы и не автоматическая переоценка статуса.'}
 (target/'catalogue-design.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');(target/'catalogue-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 with (target/'spells.csv').open('w',newline='') as f:
  w=csv.writer(f,lineterminator='\n');w.writerow(['id','name','edition','level','automation_status','implemented','note','design_candidates','scene_context'])
  for r in rows:w.writerow([r['id'],r['name'],r['edition'],r['level'],r['status'],'; '.join(r['implemented']),r['assessment'],'; '.join(c['name'] for c in r['designCandidates']),r['sceneContext']])
 print(json.dumps({k:v for k,v in summary.items() if k not in ['structuralProblems','proposalFamilies']},ensure_ascii=False));print('Structural problems',len(problems))
if __name__=='__main__':main()
