#!/usr/bin/env python3
"""False Life editions share application but not their dice or duration."""
import copy,json,sys
from pathlib import Path
s={x['id']:x for x in json.loads(Path(sys.argv[1]).read_text())};root=Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True);plans=[]
for id,n,status,note in [(658,1,'partial','Временные ХП применяются, не складываются и не восстанавливают обычные. Истечение часа и снятие оставшихся ХП именно этого источника пока отмечаются вручную.'),(6347,2,'full','Правила 2024: 2к4 + 4 временных ХП, +5 за круг выше; применение к себе, расход ячейки, результат в уведомлении/хронике. Временные ХП не складываются и не заменяют лечение.')]:
 x=s[id];fields={'heal':{'kind':'temporary_hp','dices':[{'count':n,'dice_id':'d4','bonus':4}],'addon':[{'bonus':5}],'scaling':'slot'},'application_targets':{'self_only':True},'rolls':[]}
 plans.append({'id':id,'name':x['name'],'changes':{k:{'before':x['data'].get(k),'after':v} for k,v in fields.items()},'effectsBefore':x['data'].get('status_effects',[]),'metadataBefore':{k:x.get(k) for k in ['automationStatus','automationNote','requiresPlayerInteraction']},'automationStatus':status,'automationNote':note,'requiresPlayerInteraction':False})
(root/'plan.json').write_text(json.dumps(plans,ensure_ascii=False,indent=2)+'\n');(root/'effects.json').write_text('[]\n');print('Prepared 2 spells')
