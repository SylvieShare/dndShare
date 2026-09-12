#!/usr/bin/env python3
"""Prepare reviewed field patches from a handbook export and cached TTG responses.

Usage: python3 scripts/spell-rules/prepare.py output/rules-audit
The output is a reviewable patch plan, never an automatic database migration.
"""
import copy, json, pathlib, sys, re
from content_corrections import correct, paragraph
from effect_formulas import correct_effects
from upper_summaries import summarize

root=pathlib.Path(sys.argv[1]); catalogue=json.loads((root/'catalogue-before.json').read_text())
plan=[]
for original in catalogue['items']:
    if original['typeId'] not in [3,4,5,7]:continue
    item=copy.deepcopy(original);source=None;upper=''
    if item['typeId']==5:
        source=json.loads((root/'ttg'/f"{item['id']}.json").read_text())
        # Reference text remains local; only concise restatements enter the catalogue.
        from html.parser import HTMLParser
        class Text(HTMLParser):
            def __init__(self,html):super().__init__();self.parts=[];self.feed(html)
            def handle_data(self,text):self.parts.append(text)
        upper=' '.join(' '.join(Text(source.get('upper','')).parts).split())
    correct(item)
    if item['typeId']==5:correct_effects(item)
    if upper and item['id']!=1314:
        desc=re.sub(r'<p>\s*На больших уровнях[.:]?\s*</p>', '', item['data'].get('description',''))
        heading='На больших уровнях героя. ' if item['data']['lvl']==0 else 'На больших кругах. '
        item['data']['description']=desc+paragraph(heading+summarize(item['id'],upper))
    changes={k:{'before':original['data'].get(k),'after':v} for k,v in item['data'].items() if v!=original['data'].get(k)}
    if changes:plan.append({'id':item['id'],'name':item['name'],'typeId':item['typeId'],
        'source':'https://5e14.ttg.club'+source['url'] if source else None,'changes':changes})
(root/'correction-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print('Changed items:',len(plan),'spells:',sum(p['typeId']==5 for p in plan),'abilities:',sum(p['typeId']!=5 for p in plan))
print('Upper descriptions:',sum(bool(json.loads(f.read_text()).get('upper'))for f in (root/'ttg').glob('*.json')))
