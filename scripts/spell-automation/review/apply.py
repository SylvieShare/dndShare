#!/usr/bin/env python3
"""Apply only reviewed changes via MCP, preserving unrelated concurrent changes.

Preflight the whole batch before creating effects. Existing effect codes may be
reused only when their full content matches; conflicting edits stop the run.
"""
import argparse, json, os, urllib.request
from pathlib import Path
META = ['automationStatus', 'automationNote', 'requiresPlayerInteraction']
def call(name, arguments):
    request = urllib.request.Request(os.environ.get('MCP_URL', 'http://127.0.0.1:8080/mcp'), data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer '+os.environ['MCP_AUTH_TOKEN']})
    result = json.load(urllib.request.urlopen(request, timeout=90))
    if 'error' in result or result['result'].get('isError'): raise RuntimeError(result)
    return result['result']['structuredContent']['result']
def rows(value): return value if isinstance(value, list) else value['items']
def get(id): return next(x for x in rows(call('handbook_items_get', {'ids': [id]})) if x['id']==id)
def catalogue(kind):
    found = []
    while True:
        page = rows(call('handbook_items', {'typeId': kind, 'limit': 500, 'offset': len(found)})); found += page
        if len(page)<500: return found

def preflight(item, spec, keys):
    if item.get('userId') or item['typeId']!=5: raise RuntimeError('Not a system spell')
    for key, change in spec['changes'].items():
        if item['data'].get(key) not in [change['before'], change['after']]: raise RuntimeError(f"Data conflict: {item['id']} {key}")
    for key in META:
        if item.get(key) not in [spec['metadataBefore'][key], spec[key]]: raise RuntimeError(f"Metadata conflict: {item['id']} {key}")
    other_links = [x for x in item['data'].get('status_effects', []) if x.get('key') not in keys]
    after_links = spec['changes'].get('status_effects', {}).get('after', spec['effectsBefore'])
    after_links = [x for x in after_links if x.get('key') not in keys]
    if other_links not in [spec['effectsBefore'], after_links]: raise RuntimeError(f"Effect links changed: {item['id']}")

def verify(item, data, meta):
    if item['data'] != data or any(item.get(k) != v for k,v in meta.items()): raise RuntimeError(f"Readback differs: {item['id']}")
def update(item, data, meta):
    call('handbook_item_update', {'id': item['id'], 'name': item['name'], 'nameEn': item.get('nameEn') or '', 'data': json.dumps(data, ensure_ascii=False), **meta})
    actual = get(item['id']); verify(actual, data, meta); return actual

def main():
    p=argparse.ArgumentParser(); p.add_argument('directory'); p.add_argument('--apply', action='store_true'); args=p.parse_args()
    root=Path(args.directory); plan=json.loads((root/'plan.json').read_text()); effects=json.loads((root/'effects.json').read_text())
    keys={x['key'] for x in effects}; byspell={x['id']: x for x in plan}
    current={x['id']: x for x in catalogue(5)}; effect_rows=catalogue(15); bycode={x['data'].get('code'):x for x in effect_rows}
    for spec in plan: preflight(current[spec['id']], spec, keys)
    for effect in effects:
        existing=bycode.get(effect['key'])
        if existing and (existing.get('userId') or existing['data']!=effect['data']): raise RuntimeError('Conflicting effect code '+effect['key'])
    print(json.dumps({'preflight': 'ok', 'spells':len(plan), 'effects':len(effects), 'apply':args.apply}), flush=True)
    if not args.apply: return
    # Preserve the first backup across retries.
    backup=root/'before-apply.json'
    if not backup.exists(): backup.write_text(json.dumps({'spells':list(current.values()),'effects':effect_rows},ensure_ascii=False,indent=2)+'\n')
    links={}; created=[]; changed=[]
    for effect in effects:
        existing=bycode.get(effect['key']); spec=byspell[effect['spellId']]
        source=get(effect['spellId'])
        meta={k:spec[k] for k in META}; meta['requiresPlayerInteraction']=False
        if not existing:
            compatibility=[{'sourceVersionId':c['sourceVersionId'],'status':c['status'],'note':c.get('note','')} for c in source.get('compatibility',[]) if c['status'] in ['native','compatible']]
            result=call('handbook_item_create', {'typeId':15,'name':effect['name'],'nameEn':effect['nameEn'] or '', 'data':json.dumps(effect['data'],ensure_ascii=False),
                'compatibility':compatibility,**meta})
            id=result['id'] if isinstance(result,dict) else result
            existing=get(id); verify(existing,effect['data'],meta); created.append(id)
        call('handbook_item_set_content_sources', {'id':existing['id'],'contentSourceIds':source.get('contentSourceIds',[])})
        if source.get('iconImageId') or source.get('iconSvgId'):
            call('handbook_item_reuse_icon',{'itemId':existing['id'],'sourceItemId':source['id']})
            actual=get(existing['id'])
            if any(actual.get(k)!=source.get(k) for k in ['iconImageId','iconSvgId']): raise RuntimeError('Icon mismatch')
        link={'key':effect['key'],'effect':{'id':existing['id']},'duration':effect['duration'],'concentration':effect['data']['concentration']}
        if effect.get('apply_on'): link['apply_on']=effect['apply_on']
        if effect['condition']: link['condition']=effect['condition']
        if effect.get('duration_levels'): link['duration_levels']=effect['duration_levels']
        links.setdefault(source['id'],[]).append(link)
        print(json.dumps({'effect':effect['key'],'id':existing['id']},ensure_ascii=False),flush=True)
        (root/'effect-progress.json').write_text(json.dumps({'created':created,'links':links},ensure_ascii=False,indent=2))
    for spec in plan:
        item=get(spec['id']); preflight(item,spec,keys); data=item['data'].copy()
        data.update({k:c['after'] for k,c in spec['changes'].items()})
        if item['id'] in links: data['status_effects']=spec['effectsBefore']+links[item['id']]
        meta={k:spec[k] for k in META}
        if data!=item['data'] or any(item.get(k)!=v for k,v in meta.items()):
            update(item,data,meta); changed.append(item['id'])
            print(json.dumps({'spell':item['id'],'name':item['name']},ensure_ascii=False),flush=True)
    (root/'applied.json').write_text(json.dumps({'createdEffects':created,'updatedSpells':changed,'effectLinks':links,'applied':True},ensure_ascii=False,indent=2)+'\n')
    for kind in [5,15]: (root/f'after-{kind}.json').write_text(json.dumps(catalogue(kind),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'complete':True,'createdEffects':len(created),'updatedSpells':len(changed)}),flush=True)
if __name__=='__main__': main()
