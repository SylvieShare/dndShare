#!/usr/bin/env python3
"""Full structural inventory plus independent readback of this reviewed batch."""
import argparse, csv, html, json, re
from collections import Counter
from pathlib import Path

def plain(text): return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', text or ''))).strip()
def inventory(spells, effects):
    byid={x['id']:x for x in effects}; issues=[]
    for item in spells:
        data=item['data']; flags=[]; text=plain(data.get('description'))
        for key in ['time','range','duration','components','schoolId','lvl']:
            if key not in data: flags.append('missing:'+key)
        if item.get('automationStatus') not in ['full','partial','none']: flags.append('missing:automationStatus')
        if 'концентрац' in data.get('duration','').lower() and not data.get('concentration'): flags.append('concentration:duration-without-flag')
        for i,rule in enumerate([data.get('damage',{}),data.get('heal',{}),*data.get('rolls',[])]):
            if rule.get('save_ability') and rule['save_ability'] not in ['str','dex','con','int','wis','cha']: flags.append(f'roll:{i}:invalid-save')
            if rule.get('dices') and rule.get('scaling') in ['slot','cantrip'] and not (rule.get('addon') or rule.get('addon_instances')): flags.append(f'roll:{i}:growth-without-increment')
            for die in rule.get('dices',[]):
                if i!=1 and (rule.get('kind') or 'damage')=='damage' and not die.get('type'): flags.append(f'roll:{i}:untyped-damage-needs-review')
        for link in data.get('status_effects',[]):
            effect=byid.get((link.get('effect') or {}).get('id'))
            if not effect: flags.append('effect:missing-reference'); continue
            sources=effect['data'].get('application_sources',[])
            if not any(x.get('item',{}).get('id')==item['id'] for x in sources): flags.append('effect:missing-backlink')
        if re.search(r'\d+\s*[кd]\d+',text) and not data.get('damage',{}).get('dices') and not data.get('heal',{}).get('dices') and not data.get('rolls'):
            flags.append('candidate:dice-in-description-without-roll')
        if flags: issues.append({'id':item['id'],'name':item['name'],'flags':list(dict.fromkeys(flags))})
    return issues

def report(root, output):
    spells=json.loads((root/'after-5.json').read_text()); effects=json.loads((root/'after-15.json').read_text())
    byid={x['id']:x for x in spells}; byeffect={x['id']:x for x in effects}
    plan=json.loads((root/'plan.json').read_text()); specs=json.loads((root/'effects.json').read_text()); applied=json.loads((root/'applied.json').read_text())
    before=json.loads((root/'before-apply.json').read_text()); failures=[]
    for p in plan:
        actual=byid[p['id']]
        for key in ['automationStatus','automationNote','requiresPlayerInteraction']:
            if actual.get(key)!=p[key]: failures.append(f"{p['id']}: {key}")
        for key,change in p['changes'].items():
            if actual['data'].get(key)!=change['after']: failures.append(f"{p['id']}: {key}")
        if str(p['id']) in applied['effectLinks']:
            if actual['data'].get('status_effects') != p['effectsBefore']+applied['effectLinks'][str(p['id'])]: failures.append(f"{p['id']}: effect links")
    verified_effects=[]
    for spec in specs:
        link=next(x for x in applied['effectLinks'][str(spec['spellId'])] if x['key']==spec['key']); effect=byeffect[link['effect']['id']]; spell=byid[spec['spellId']]
        if effect['data']!=spec['data']: failures.append(spec['key']+': data')
        if any(effect.get(k)!=spell.get(k) for k in ['iconImageId','iconSvgId']): failures.append(spec['key']+': icon')
        verified_effects.append([spec['spellId'],spec['key'],effect['name'],effect['id']])
    for old in before['spells']:
        if old['id'] not in byid: failures.append(f"Missing spell {old['id']}"); continue
        actual=byid[old['id']]
        if old['name']!=actual['name'] or old['data'].get('description')!=actual['data'].get('description'): failures.append(f"Changed prose {old['id']}")
    issues=inventory(spells,effects)
    summary={'date':'2026-09-19','spellsStructurallyAudited':len(spells),'spellsChanged':len(plan),'mechanicalFieldsChanged':sum(bool(x['changes']) for x in plan),'mechanicallyChangedSpells':len({x['id'] for x in plan if x['changes']}|{x['spellId'] for x in specs}),'statuses':dict(Counter(x['automationStatus'] for x in spells)), 'effectsCreatedAndVerified':len(specs),'sameIconIds':len(specs),'effectSources':len(specs),'readbackFailures':failures,'structuralFlags':dict(Counter(f for x in issues for f in x['flags']))}
    if failures: raise RuntimeError(failures)
    output.mkdir(parents=True,exist_ok=True)
    with (output/'spells.csv').open('w') as f:
        w=csv.writer(f,lineterminator="\n");w.writerow(['id','name','automation_status','requires_player_interaction','note'])
        w.writerows([x['id'],x['name'],x['automationStatus'],x.get('requiresPlayerInteraction',False),x.get('automationNote','')] for x in spells)
    with (output/'review-effects.csv').open('w') as f:
        w=csv.writer(f,lineterminator="\n");w.writerow(['spell_id','key','name','effect_id']);w.writerows(verified_effects)
    for name,data in [('review-verification.json',summary),('structural-review.json',issues)]: (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('output',type=Path);a=p.parse_args();report(a.directory,a.output)
