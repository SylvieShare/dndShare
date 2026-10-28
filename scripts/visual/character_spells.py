"""Real Compose spell rolls, healing and created inventory with a disposable API/session."""
import http.cookiejar
import json
import re
import time
import urllib.parse
import urllib.request
import uuid

from android import build_install, login


def spell_actions(device, root, url, output, fixture, stats):
    if urllib.parse.urlparse(url).hostname != '127.0.0.1' or fixture['login'] != 'native_tester':
        raise ValueError('Spell checks require the disposable loopback fixture')
    def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    owner, master=client(),client()
    def request(opener,path,data=None,method=None):
        call=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json'})
        with opener.open(call,timeout=25) as response:
            raw=response.read();return json.loads(raw) if raw else None
    request(owner,'/api/user/auth',{key:fixture[key] for key in ('login','password')})
    credentials={'login':'native_spells_master','password':'Native-pass-42'}
    request(master,'/api/user/registration',credentials);request(master,'/api/user/auth',credentials)
    original=fixture['characters'][0]['uuid'];before=request(owner,'/api/char/'+original)['data']
    clone=request(owner,'/api/char/'+original+'/clone',{},'POST')['uuid']
    session_id=None;checks=[]
    def document():return request(owner,'/api/char/'+clone)
    def wait(predicate,label):
        deadline=time.monotonic()+40
        while time.monotonic()<deadline:
            if predicate():return
            time.sleep(.2)
        device.tree();raise AssertionError('Native spell check failed: '+label)
    def scroll(tree):
        nodes=[node for node in tree.iter('node') if node.get('scrollable')=='true']
        if nodes:
            left,top,right,bottom=map(int,re.findall(r'\d+',nodes[-1].get('bounds','')));x=(left+right)//2
            device.shell('input','swipe',str(x),str(bottom-24),str(x),str(top+24),'300')
        else:device.shell('input','swipe','195','720','195','280','300')
    def click(label,description=False):
        for _ in range(15):
            tree=device.tree();nodes=[node for node in tree.iter('node') if node.get('content-desc' if description else 'text')==label]
            if nodes:device.tap(nodes[-1]);return
            scroll(tree)
        raise AssertionError('Missing native spell control: '+label)
    def enter(label,value):
        if 'mInputShown=true' in device.shell('dumpsys','input_method'):device.shell('input','keyevent','4')
        for _ in range(12):
            tree=device.tree();edits=[node for node in tree.iter('node') if node.get('class')=='android.widget.EditText']
            node=next((node for node in edits if node.get('content-desc')==label),None)
            if node is None:
                for caption in tree.iter('node'):
                    if caption.get('text')!=label:continue
                    box=list(map(int,re.findall(r'\d+',caption.get('bounds',''))))
                    for candidate in edits:
                        bounds=list(map(int,re.findall(r'\d+',candidate.get('bounds',''))))
                        if len(box)==4 and len(bounds)==4 and bounds[0]<=box[0]<bounds[2] and bounds[1]<=box[1]<bounds[3]:node=candidate;break
            if node is not None:
                device.tap(node);device.shell('input','keyevent','123')
                for _ in range(len(node.get('text',''))+2):device.shell('input','keyevent','67')
                device.shell('input','text',str(value).replace(' ','%s'));return
            scroll(tree)
        raise AssertionError('Missing native spell input: '+label)
    def close_dice():
        tree=device.tree()
        nodes=[node for node in tree.iter('node') if node.get('content-desc')=='Закрыть уведомление']
        if nodes:device.tap(nodes[-1])
    def checkpoint(label):
        checks.append(label);print('native spell actions: '+label,flush=True)
        (output/'spell-actions-progress.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    try:
        current=document();values=current['data']['values'];book=values['spells']
        book['tabs'][0]['casting_ability']=4
        book['tabs'][0]['spells'] += [{'key':'heal','id':2,'prepared':True},{'key':'pages','id':3,'prepared':True}]
        book['slot_pools']['long_rest'].append({'level':3,'total':2,'used':0})
        hp={**values['hp'],'current':3}
        request(owner,'/api/char/'+clone+'/data',{'baseVersion':current['version'],'mutationId':str(uuid.uuid4()),'patches':[
            {'op':'set','path':['values','name'],'value':'SpellHero'},
            {'op':'set','path':['values','spells'],'value':book},
            {'op':'set','path':['values','hp'],'value':hp},
            {'op':'set','path':['values','states'],'value':[{'uid':'aim','effect_id':215,'params':{},'source':{'kind':'manual'},'duration':{'kind':'manual'},'concentration':False}]}]},'PATCH')
        session=request(master,'/api/sessions',{'name':'Spell Checks','systemId':1,'sourceVersionId':fixture['edition']['id']})
        session_id=session['id'];session_uuid=session['uuid']
        identity=next(row['id'] for row in request(owner,'/api/chars')['chars'] if row['uuid']==clone)
        request(owner,'/api/sessions/'+session_uuid+'/join',{'charId':identity,'replaceExisting':False})
        def events():return request(master,'/api/sessions/'+session_uuid+'/events')['events']
        def used(level):return next(row['used'] for row in document()['data']['values']['spells']['slot_pools']['long_rest'] if row['level']==level)
        build_install(device,root,url,output)
        device.shell('wm','density','160');device.shell('wm','size','390x900');login(device,fixture)
        click('Открыть меню',True);click('Персонажи');click('SpellHero');click('Магия',True)
        click('Ячейка 1 круга · 2',True)
        wait(lambda:used(1)==2,'native orb spends the selected slot')
        click('Ячейка 1 круга · 2',True)
        wait(lambda:used(1)==1,'native orb restores the selected slot')
        checkpoint('native slot orbs update the selected pool and restore the exact initial stock')
        def menu(name,action):click('Действия с записью: '+name,True);click(action)
        menu(fixture['recordName'],'Броски заклинания')
        click('Тип урона атаки',True);click('Холод')
        score=values['INT']['value'];modifier=(score['base']+sum(row.get('value',0) for row in score.get('bonuses',[]))-10)//2
        click('Атака +'+str(modifier+2))
        wait(lambda:any(row['type']=='dice_roll' for row in events()),'spell attack event')
        attack=next(row['data'] for row in events() if row['type']=='dice_roll')
        assert attack['entryKey']=='primer' and attack['source']['itemId']==1 and attack['damageType']['id']==2
        assert len(attack['result']['parts'][0]['rolls'])==2 and attack['result']['rollMode']=='advantage'
        wait(lambda:document()['data']['values']['states']==[],'attack consumes linked ending state')
        assert used(1)==1
        checkpoint('spell attack uses numeric casting ability, karmic advantage and ends attack-bound states')
        close_dice();menu(fixture['recordName'],'Броски заклинания')
        click('Круг броска',True);click('3 круг');click('Бросить урон')
        wait(lambda:len([row for row in events() if row['type']=='dice_roll'])==2,'upcast damage event')
        damage=next(row['data'] for row in events() if row['type']=='dice_roll' and row['data'].get('damageRoll'))
        assert damage['castLevel']==3 and damage['result']['parts'][0]['n']==3
        assert [row['label'] for row in damage['result']['byType']]==['Холод'] and used(1)==1 and used(3)==0
        checkpoint('typed upcast damage preserves the previous damage choice and does not spend a slot')
        close_dice();menu(fixture['recordName'],'Броски заклинания');click('Запросить спасбросок')
        wait(lambda:any(row['type']=='spell_used' and row['data'].get('savingThrow') for row in events()),'saving throw request')
        save=next(row['data']['savingThrow'] for row in events() if row['type']=='spell_used' and row['data'].get('savingThrow'))
        assert save['ability']==2 and save['dc']==8+2+modifier and save['onSuccess']=='half'
        click('Закрыть');menu('Учебное лечение','Сотворить');click('На себя');click('Применить')
        wait(lambda:document()['data']['values']['hp']['current']>3,'real server healing')
        assert used(1)==2
        checkpoint('self healing and slot spending are one confirmed server action')
        menu('Сотворение страниц','Сотворить')
        click('3');click('Обычные ячейки');click('Результат сотворения',True);click('Чистые страницы');click('Создать весь объём')
        enter('Количество','3')
        if 'mInputShown=true' in device.shell('dumpsys','input_method'):device.shell('input','keyevent','4')
        click('Применить')
        def creations():return [row for section in document()['data']['values']['items']['sections'] for row in section.get('items',[]) if row.get('params',{}).get('creation',{}).get('spell_id')==3]
        wait(lambda:len(creations())==1,'created inventory entry')
        assert creations()[0]['count']==3 and creations()[0]['params']['creation']['on_expire']=='vanish' and used(3)==1
        checkpoint('upcast item creation stores the chosen quantity and lifetime and spends one slot')
        created_uid=creations()[0]['uid']
        click('Предметы',True)
        for _ in range(15):
            tree=device.tree()
            row=next((node for node in tree.iter('node') if node.get('resource-id')=='sheet-entry:'+created_uid),None)
            if row is not None:device.tap(row);break
            scroll(tree)
        else:raise AssertionError('Created inventory UID is not reachable')
        click('Отметить окончание срока');click('Предметы исчезли')
        wait(lambda:creations()==[],'created stack expires through its native action')
        assert used(3)==1
        checkpoint('expiry removes only the chosen created stack without refunding its slot')
    finally:
        if session_id is not None:request(master,'/api/sessions/'+str(session_id),method='DELETE')
        request(owner,'/api/char/'+clone,method='DELETE')
        assert request(owner,'/api/char/'+original)['data']==before
    (output/'spell-actions.json').write_text(json.dumps({'passed':True,'realCompose':True,'realAPI':True,'fixtureRestored':True,'actions':checks},ensure_ascii=False,indent=2))
