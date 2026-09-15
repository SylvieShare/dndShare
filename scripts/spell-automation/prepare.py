#!/usr/bin/env python3
"""Build a conflict-checked catalogue plan from the full exported spell catalogue.

Full coverage is an explicit reviewed allowlist. Missing mechanics are retained
as per-item follow-up notes, never silently converted into unconditional bonuses.
"""
import argparse,copy,html,json,re
from collections import defaultdict,Counter
from pathlib import Path
from effects import EFFECTS
from saves import MANUAL_SAVES
p=argparse.ArgumentParser();p.add_argument('snapshot');p.add_argument('output');args=p.parse_args()
export=[json.loads(line) for line in open(args.snapshot)]
spells=next(row['items'] for row in export if row['kind']==5)
byid={row['id']:row for row in spells}
def plain(text):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',text or ''))).strip()
def duration(data):
 text=data.get('duration','').lower()
 for token,kind in [('раунд','rounds'),('минут','minutes'),('час','hours'),('день','hours'),('дней','hours')]:
  match=re.search(r'(\d+)\s*'+token,text)
  if match:return {'kind':kind,'value':int(match[1])*(24 if token in ['день','дней'] else 1)}
 return {'kind':'manual'}
mechanics=defaultdict(list)
for spec in EFFECTS:mechanics[spec['spell']].append(spec)
# These spells expose healing dice for a later action, object, pool or repeated
# trigger. Applying the formula to every recipient at cast time is incorrect.
manual_heal={857:'Лечение бонусным действием из ауры, а не в момент её создания.',487:'Восстанавливает древесные объекты; проверка типа цели и их состояния нужна отдельно.',738:'Отдельные срабатывания духа, ограничение числа использований и вход в его пространство.',1226:'Захват души и шесть использований её свойств требуют отдельного ресурса.',602:'Создаёт переносимый эликсир; лечение происходит при его употреблении.',1152:'Лечение выбранных конструктов, а не произвольных персонажей.',1401:'Общий запас 700 хитов распределяется между целями; 700 каждой цели применять нельзя.',794:'Лечение конструкта и особые ограничения цели.',1320:'После начального лечения восстанавливает 1 хит в начале хода и конечности; нужна единая длительная процедура.'}
# Direct, verified target counts; no multiplication of a shared pool.
targets={548:(3,1),646:(3,1),916:(6,0),1154:(6,0),758:(6,0),764:(1,1),937:(10,0),1335:(1,3)}
abilities={'силы':'str','ловкости':'dex','телосложения':'con','интеллекта':'int','мудрости':'wis','харизмы':'cha'}
spell_save={646:'cha',841:'wis',1206:'wis',717:'con',882:'wis',580:'wis'}
# A simple save clause is safe to publish. More than one characteristic is kept
# in the audit for a phase-aware workflow instead of selecting one arbitrarily.
clauses=re.compile(r'[^.!?]*(?:долж(?:ен|на|но|ны)|соверш(?:ает|ают|ить)|преуспеть)[^.!?]{0,65}спасброс\w*\s+(силы|ловкости|телосложения|интеллекта|мудрости|харизмы)[^.!?]*[.!?]?',re.I)
followup=[]; plan=[]; effect_plan=[]
for item in spells:
 original=item['data']; data=copy.deepcopy(original); id=item['id']; text=plain(data['description']); low=text.lower()
 hits=[h for h in clauses.finditer(text) if re.search(r'(?:долж(?:ен|на|но|ны)|преуспеть)[^.!?]{0,65}спасброс',h[0],re.I) and not re.search(r'с (?:преимуществом|помехой) спасброс',h[0],re.I)]; saves={abilities[h[1].lower()] for h in hits}
 # Do not mistake self saves, defensive bonuses, or rules quoted from another
 # spell for a save inflicted on a target.
 rejected=any(re.search(r'\bвы\b.{0,25}(?:должны|совершаете|преуспеть)',h[0],re.I) for h in hits)
 if id in spell_save:data.setdefault('damage',{})['save_ability']=spell_save[id]
 elif not data.get('damage',{}).get('save_ability') and len(saves)==1 and not rejected and id != 725:
  data.setdefault('damage',{})['save_ability']=next(iter(saves))
  data['damage']['save_condition']=plain(hits[0][0])[:500]
  data['damage']['save_manual']=True
 if id in MANUAL_SAVES and not data.get('damage',{}).get('save_ability'):
  data.setdefault('damage',{}).update(save_ability=MANUAL_SAVES[id],save_manual=True)
  save_sentences=[s for s in re.split(r'(?<=[.!?])\s+',text) if 'спасброс' in s.lower()]
  data['damage']['save_condition']=(save_sentences[0] if save_sentences else 'При наступлении описанного в заклинании условия.')[:500]
 if id in manual_heal:data['heal']['apply']=False
 if id in targets:
  count,per_slot=targets[id];data['application_targets']={**data.get('application_targets',{}),'count':count,'per_slot':per_slot}
 for spec in mechanics[id]:
  key='spell_'+str(id)+'_'+spec['key']; timed=spec['duration'] or duration(data)
  effect={'code':key,'desc':spec['desc'],'polarity':'negative' if id in [646,841,1206,717,882] else 'positive','stacking':'single','duration':timed,'concentration':data.get('concentration',False),'derived_effects':spec['rules'],'defenses':spec['defenses'],'application_sources':[{'item':{'id':id},'key':key,'target':'other' if spec['condition'] else 'self','condition':spec['condition']}],**spec['extra']}
  if spec['weapon']:effect['weapon_damage']=[{'key':key,'label':item['name'],'double_on_critical':True,**spec['weapon']}]
  effect_plan.append({'spellId':id,'key':key,'name':spec['name'] or item['name'],'nameEn':item.get('nameEn',''),'data':effect,'condition':spec['condition'],'duration':timed,'parameter_bindings':spec['bindings'],'duration_levels':spec['duration_levels']})
  if spec['count'] is not None:data['application_targets']={**data.get('application_targets',{}),'count':spec['count'],'per_slot':spec['per_slot']}
  if spec['self_only']:data['application_targets']={**data.get('application_targets',{}),'self_only':True}
 # Catalogue evaluation: full coverage is never inferred from a field count.
 if mechanics[id]:
  status='full' if all(spec['full'] for spec in mechanics[id]) else 'partial'
  note=' '.join(dict.fromkeys(spec['note'] for spec in mechanics[id] if spec['note'])) or 'Применение эффекта, длительность и заявленные бонусы поддержаны.'
 elif id in [548,693]:status='full';note='Выбор целей, ячейка, эффект и концентрация связаны; бонус применяется к параметрам листа.'
 elif id in manual_heal:status='partial';note='Формула доступна для броска. '+manual_heal[id]
 else:
  # Conservative assessment of unresolved semantic mechanics, with specific
  # categories and original evidence recorded for the follow-up review.
  gaps=[]
  categories=[
   (r'превращ|форму .*существа|новой формы','Превращение, характеристики формы и возврат исходного состояния'),
   (r'призыва|созда[её]те.*существ|оживля|поднима[её]те.*м[её]рт','Создание/контроль существ и их отдельные листы'),
   (r'телепорт|план существования|другой план|другое измерение','Перемещение и переходы между планами'),
   (r'кость хитов|кости хитов|костей хитов','Расход и формулы от костей хитов цели/заклинателя'),
   (r'максимум.{0,15}хит|хитов.{0,20}(уменьша|увелич)|временн\w* хит','Изменение максимума или связанных временных хитов'),
   (r'таблиц|случайным образом','Выбор результата по таблице/случайной ветке'),
   (r'очарова|испуган|парализ|ослеп|отравл|оглуш|опутан|недееспособ','Условия наложения, снятия и последствия состояний'),
   (r'в начале.{0,30}ход|в конце.{0,30}ход|входит в|войд[её]т','Повторные срабатывания и вход/выход из области'),
   (r'сопротивлен|иммунитет|невосприимчив','Условные сопротивления и иммунитеты'),
   (r'преимуществ|помех|бонус|штраф','Контекстные бонусы и режимы бросков'),
   (r'атак\w* оружием|оружие становится|зачарованн\w* оруж','Изменение конкретного оружия и условия попадания'),
  ]
  for pattern,label in categories:
   if re.search(pattern,low):gaps.append(label)
  if len(saves)>1:gaps.insert(0,'Несколько разных спасбросков: этапы и цели нельзя смешивать')
  damage=data.get('damage',{});heal=data.get('heal',{})
  # Rolls are supporting functionality; their presence never yields "full".
  supported=[]
  if damage.get('dices') or data.get('rolls'):supported.append('формулы бросков')
  if damage.get('range_attack'):supported.append('атака заклинанием')
  if damage.get('save_ability'):supported.append('спасбросок со Сл и групповые результаты')
  if heal.get('dices') and heal.get('apply') is not False:supported.append('применение лечения')
  if data.get('status_effects'):supported.append('применение связанного эффекта и концентрация')
  status='partial' if supported else 'none'
  note=('Поддержаны '+', '.join(supported)+'. ' if supported else '')+'Требуется отдельное разрешение: '+('; '.join(gaps[:3]) if gaps else 'описанное воздействие на цели, предметы или окружение')+'.'
  if id in [601,603,916,1154,758]:
   status='full';note='Лечение, усиление за круг, модификатор, число целей и расход одной ячейки поддержаны. Допустимость цели определяется участниками.'
  if id==1254:note='Применяются 70 хитов и усиление за круг. Снятие слепоты, глухоты и болезней — вручную.'
  if id==1335:note='Эффект, длительность и дополнительные цели за круг поддержаны. Эфирный План, выталкивание из предметов и соответствующий урон — вручную.'
 if status!='full':followup.append({'id':id,'name':item['name'],'status':status,'problem':note,'description':text})
 changes={key:{'before':original.get(key),'after':value} for key,value in data.items() if original.get(key)!=value}
 plan.append({'id':id,'name':item['name'],'changes':changes,'automationStatus':status,'automationNote':note[:1000],'requiresPlayerInteraction':id in [780,888],'metadataBefore':{key:item.get(key,False if key=='requiresPlayerInteraction' else '') for key in ['automationStatus','automationNote','requiresPlayerInteraction']}})
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
for filename,value in [('plan.json',plan),('effects.json',effect_plan),('follow-up.json',followup)]:
 (out/filename).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'spells':len(plan),'newEffects':len(effect_plan),'changedData':sum(bool(row['changes']) for row in plan),'statuses':Counter(row['automationStatus'] for row in plan),'saveAdditions':sum('damage'in row['changes'] for row in plan)},ensure_ascii=False))
