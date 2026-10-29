"""Weapon rolls and grouped resource spending through real Compose, PostgreSQL and session APIs."""
import http.cookiejar
import json
import time
import urllib.parse
import urllib.request
import uuid

from android import build_install, login


def weapon_actions(device, root, url, output, fixture, stats):
    if urllib.parse.urlparse(url).hostname != '127.0.0.1' or fixture['login'] != 'native_tester':
        raise ValueError('Weapon checks require the disposable loopback fixture')
    def client():
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    owner, master = client(), client()
    def request(opener, path, data=None, method=None):
        req=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json'})
        with opener.open(req,timeout=25) as response:
            raw=response.read();return json.loads(raw) if raw else None
    request(owner,'/api/user/auth',{key:fixture[key] for key in ('login','password')})
    credentials={'login':'native_weapons_master','password':'Native-pass-42'}
    request(master,'/api/user/registration',credentials);request(master,'/api/user/auth',credentials)
    original=fixture['characters'][0]['uuid']
    before=request(owner,'/api/char/'+original)['data']
    clone=request(owner,'/api/char/'+original+'/clone',{},'POST')['uuid']
    session_id=None;checks=[]
    def document():return request(owner,'/api/char/'+clone)
    def wait(predicate,label):
        deadline=time.monotonic()+35
        while time.monotonic()<deadline:
            if predicate():return
            time.sleep(.2)
        device.tree();raise AssertionError('Native weapon check failed: '+label)
    def click(label,description=False):
        attr='content-desc' if description else 'text'
        for reverse in (False,True):
            previous=None
            for _ in range(12):
                tree=device.tree();nodes=[node for node in tree.iter('node') if node.get(attr)==label]
                if nodes:device.tap(nodes[-1]);return
                signature=tuple((node.get('text'),node.get('content-desc'),node.get('bounds')) for node in tree.iter('node'))
                if signature==previous:break
                previous=signature
                scroll(tree,reverse)
        raise AssertionError('Missing weapon control: '+label)
    def open_roll(title):
        # Card also hosts independent mechanic disclosures; tap its heading, not its geometric centre.
        click(title)
        click('Бросок оружием')
    def sheet_closed():
        wait(lambda:not any(n.get('content-desc')=='Потянуть, чтобы закрыть' for n in device.tree().iter('node')),'mechanic sheet closes before feedback')
    def open_discharge():
        click('Особое применение: Разряд',True)

    def scroll(tree,reverse=False):
        import re
        nodes=[node for node in tree.iter('node') if node.get('scrollable')=='true']
        if nodes:
            left,top,right,bottom=map(int,re.findall(r'\d+',nodes[-1].get('bounds','')))
            x=(left+right)//2
            device.shell('input','swipe',str(x),str(top+24 if reverse else bottom-24),str(x),str(bottom-24 if reverse else top+24),'300')
        else:device.shell('input','swipe','195','720','195','280','300')
    def close_dice():
        tree=device.tree()
        nodes=[node for node in tree.iter('node') if node.get('content-desc')=='Закрыть уведомление']
        if nodes:device.tap(nodes[-1])
    def checkpoint(label):
        checks.append(label);print('native weapon actions: '+label,flush=True)
        (output/'weapon-actions-progress.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    try:
        current=document();values=current['data']['values']
        inventory=values['items'];weapons=values['weapon']
        staff=next(row for row in inventory['equipped'] if row.get('item_id')==206)
        inventory['equipped']=[row for row in inventory['equipped'] if row['uid']!=staff['uid']]
        staff.pop('count',None);weapons.append(staff)
        prof={**values.get('proficiencies',{}),'Оружие':['Простое оружие']}
        request(owner,'/api/char/'+clone+'/data',{'baseVersion':current['version'],'mutationId':str(uuid.uuid4()),'patches':[
            {'op':'set','path':['values','name'],'value':'WeaponHero'},
            {'op':'set','path':['values','proficiencies'],'value':prof},
            {'op':'set','path':['values','items'],'value':inventory},
            {'op':'set','path':['values','weapon'],'value':weapons},
            {'op':'set','path':['values','abilities_class'],'value':[{'id':213,'count':3,'resource_version':1}]}]},'PATCH')
        session=request(master,'/api/sessions',{'name':'Weapon Checks','systemId':1,'sourceVersionId':fixture['edition']['id']})
        session_id=session['id'];session_uuid=session['uuid']
        identity=next(row['id'] for row in request(owner,'/api/chars')['chars'] if row['uuid']==clone)
        request(owner,'/api/sessions/'+session_uuid+'/join',{'charId':identity,'replaceExisting':False})
        def dice_events():return [row for row in request(master,'/api/sessions/'+session_uuid+'/events')['events'] if row['type']=='dice_roll']
        build_install(device,root,url,output)
        device.shell('wm','density','160');device.shell('wm','size','390x900');login(device,fixture)
        click('Открыть меню',True);click('Персонажи');click('WeaponHero');click('Оружие',True)
        open_roll('Учебный посох')
        score=values['STR']['value'];strength=score['base']+sum(row.get('value',0) for row in score.get('bonuses',[]))
        bonus=(strength-10)//2+2
        click('Атака '+('+' if bonus>=0 else '')+str(bonus))
        wait(lambda:len(dice_events())==1,'session attack event')
        event=dice_events()[0]['data']
        assert event['attackRoll'] is True and event['source']['itemId']==206
        part=event['result']['parts'][0]
        assert part['kind']=='dice' and part['sides']==20 and len(part['rolls'])==1
        assert event['result']['total']==part['sum']+bonus
        assert document()['data']['values']['abilities_class'][0]['count']==3
        checkpoint('linked proficiency and karmic d20 with canonical chronicle result')
        close_dice()
        open_roll('Учебный посох')
        click('Пламя');click('Искра');click('Бросить урон')
        wait(lambda:document()['data']['values']['abilities_class'][0]['count']==1,'grouped resource cost')
        wait(lambda:len(dice_events())==2,'damage event')
        event=next(row['data'] for row in dice_events() if row['data'].get('damageRoll'))
        assert len(event['resourceChanges'])==1 and event['resourceChanges'][0]['delta']==-2
        assert {part['sides'] for part in event['result']['parts'] if part['kind']=='dice'}=={4,6}
        assert {part['label'] for part in event['result']['byType']}=={'Дробящий','Огонь'}
        checkpoint('typed weapon damage spends a shared pool once')
        # Verify the persistent roll form; success notifications intentionally expire.
        close_dice();open_roll('Учебный посох')
        click('Пламя');click('Искра');device.wait('Недостаточно ресурса')
        assert document()['data']['values']['abilities_class'][0]['count']==1
        assert len(dice_events())==2
        checkpoint('insufficient combined resource does not roll or spend')
        click('Закрыть');close_dice()
        current=document();weapons=current['data']['values']['weapon'];inventory=current['data']['values']['items']
        weapon=next(row for row in weapons if row.get('item_id')==206)
        weapon['magic_item_id']=214
        weapon['params']={**weapon.get('params',{}),'magic':{'remaining':3}}
        request(owner,'/api/char/'+clone+'/data',{'baseVersion':current['version'],'mutationId':str(uuid.uuid4()),'patches':[
            {'op':'set','path':['values','weapon'],'value':weapons},
            {'op':'set','path':['values','items'],'value':inventory}]},'PATCH')
        def magic():return next(row for row in document()['data']['values']['weapon'] if row.get('magic_item_id')==214)['params']['magic']
        time.sleep(6)
        open_roll('Посох молнии')
        click('Атака '+('+' if bonus>=0 else '')+str(bonus))
        wait(lambda:len(dice_events())==3,'magic weapon attack')
        assert magic()['remaining']==3
        close_dice()
        click('Удача')
        click('Перебросить: Атака: Посох молнии');sheet_closed()
        wait(lambda:magic()['remaining']==2,'confirmed paid reroll')
        wait(lambda:len(dice_events())==4,'atomic reroll chronicle')
        paid=next(row['data'] for row in dice_events() if row['data'].get('resourceSpent')==1)
        assert paid['result']['parts'][0]['sides']==20
        assert len(paid['resourceChanges'])==1 and paid['resourceChanges'][0]['delta']==-1
        checkpoint('one-time paid reroll atomically commits its resource, karmic d20 and chronicle')
        close_dice()
        open_discharge()
        click('Разряд · 1 Посох молнии');sheet_closed()
        wait(lambda:magic().get('weapon_use',{}).get('status')=='active','special weapon use begins')
        assert magic()['remaining']==1
        attack=magic()['weapon_use']['attack_result']
        assert attack['parts'][0]['sides']==20
        close_dice()
        open_discharge();click('Бросить урон: Линия');sheet_closed()
        wait(lambda:magic()['weapon_use']['steps'][0]['status']=='rolled','independent line damage')
        line=magic()['weapon_use']['steps'][0]
        assert line['half_result']==line['result']['total']//2
        close_dice()
        open_discharge();click('Промах');sheet_closed()
        wait(lambda:magic()['weapon_use']['steps'][1]['status']=='missed','weapon miss preserves first result')
        assert magic()['remaining']==1
        open_discharge();click('Завершить применение');click('Завершить');sheet_closed()
        wait(lambda:magic()['weapon_use']['status']=='completed','special weapon use completes')
        assert magic()['remaining']==1
        checkpoint('special use pays once, rolls a separate save step and records a miss')
        click('Резервный разряд')
        click('Подтвердить разряд · −1 заряд');sheet_closed()
        wait(lambda:magic().get('last_charge_check',{}).get('status')=='pending','last-charge snapshot')
        assert magic()['remaining']==0 and magic()['use_cooldowns']['reserve']==1
        check_id=magic()['last_charge_check']['id']
        click('Заряды: Проверка последнего заряда',True);click('Проверить');sheet_closed()
        wait(lambda:magic().get('lost') is True,'last charge disables magic')
        assert magic()['last_charge_check']['status']=='resolved'
        assert magic()['last_charge_check']['id']==check_id
        assert 1<=magic()['last_charge_check']['result']<=20
        close_dice()
        click('Заряды: Магические свойства утрачены',True);click('Отменить утрату магии');click('Подтвердить');sheet_closed()
        wait(lambda:magic().get('last_charge_check',{}).get('status')=='undone','undo accidental magic loss')
        assert magic()['lost'] is False and magic()['remaining']==0 and magic()['use_cooldowns']['reserve']==1
        checkpoint('confirmed result atomically spends the last charge, persists a single check, and undo restores magic without refund')
        current=document();weapons=current['data']['values']['weapon']
        weapons.append({'uid':'custom-weapon','item_id':None,'override':{'name':'Авторский удар'},'proficient':True,'stat_suggest_id':1,'params':{},'add_attacks':[{'count':1,'dice_id':'d4','type_suggest_id':1}]})
        request(owner,'/api/char/'+clone+'/data',{'baseVersion':current['version'],'mutationId':str(uuid.uuid4()),'patches':[{'op':'set','path':['values','weapon'],'value':weapons},{'op':'set','path':['values','STR','value','base'],'value':18}]},'PATCH')
        time.sleep(4)
        open_roll('Авторский удар')
        old_count=len(dice_events());click('Атака +6')
        wait(lambda:len(dice_events())==old_count+1,'custom weapon attack event')
        custom=next(row['data'] for row in dice_events() if 'Авторский удар' in row['data'].get('title',''))
        assert 'Авторский удар' in custom['title'] and custom['attackRoll'] is True
        assert custom['result']['total']==custom['result']['parts'][0]['sum']+6
        assert not custom.get('source',{}).get('itemId')
        checkpoint('custom owned weapon rolls its native attack without a catalogue item')
        close_dice()


    finally:
        if session_id is not None:request(master,'/api/sessions/'+str(session_id),method='DELETE')
        request(owner,'/api/char/'+clone,method='DELETE')
        assert request(owner,'/api/char/'+original)['data']==before
    (output/'weapon-actions.json').write_text(json.dumps({'passed':True,'realCompose':True,'realAPI':True,'fixtureRestored':True,'actions':checks},ensure_ascii=False,indent=2))
