"""Player actions in a disposable two-player session, through the real native UI/API."""
import copy
import http.cookiejar
import json
import time
import urllib.request
import uuid as uuidlib

from android import build_install, login


def session_actions(device, root, url, output, fixture, stats):
    def client():
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    owner, peer, master = client(), client(), client()
    def request(opener, path, data=None, method=None):
        req=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,
            method=method,headers={'Content-Type':'application/json'})
        with opener.open(req,timeout=20) as reply:
            raw=reply.read();return json.loads(raw) if raw else None
    def auth(opener,name,register=False):
        body={'login':name,'password':'Native-pass-42'}
        if register:request(opener,'/api/user/registration',body)
        request(opener,'/api/user/auth',body)
    request(owner,'/api/user/auth',{key:fixture[key] for key in ('login','password')})
    auth(peer,'native_peer',True);auth(master,'native_master',True)
    original=fixture['characters'][0]['uuid']
    original_data=request(owner,'/api/char/'+original)['data']
    own=request(owner,'/api/char/'+original+'/clone',{},'POST')['uuid']
    peer_uuid=None;session=None;session_id=None
    checks=[]
    def document(opener,identity):return request(opener,'/api/char/'+identity)
    def change(opener,identity,path,value):
        doc=document(opener,identity)
        request(opener,'/api/char/'+identity+'/data',{'baseVersion':doc['version'],'mutationId':str(uuidlib.uuid4()),
            'patches':[{'op':'set','path':path,'value':value}]},'PATCH')
    def wait(predicate,label):
        deadline=time.monotonic()+35
        while time.monotonic()<deadline:
            if predicate():return
            time.sleep(.2)
        raise AssertionError('Native session action not confirmed: '+label)
    def click(label,description=False):
        attr='content-desc' if description else 'text'
        deadline=time.monotonic()+35
        for _ in range(40):
            tree=device.tree()
            nodes=[n for n in tree.iter('node') if n.get(attr)==label]
            if nodes:
                selected=nodes[-1]
                time.sleep(.25)
                stable=[n for n in device.tree().iter('node') if n.get(attr)==label and n.get('enabled')!='false']
                if stable and stable[-1].get('bounds')==selected.get('bounds'):
                    device.tap(stable[-1]);return
                continue
            if time.monotonic()>deadline:break
            device.shell('input','swipe','195','720','195','300','300')
        raise AssertionError('Missing native session control: '+label)
    def text(value,index=0):
        nodes=[n for n in device.tree().iter('node') if n.get('class')=='android.widget.EditText']
        node=nodes[index];device.tap(node);device.shell('input','keyevent','123')
        for _ in range(len(node.get('text',''))+2):device.shell('input','keyevent','67')
        device.shell('input','text',value)
    def checkpoint(label):
        print('native session actions: '+label,flush=True);checks.append(label)
        (output/'session-actions-progress.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    try:
        change(owner,own,['values','name'],'PartyHero')
        money=document(owner,own)['data']['values']['money'];money['amounts']['1']=10
        change(owner,own,['values','money'],money)
        peer_data=copy.deepcopy(original_data);peer_data['values']['name']='PeerHero';peer_data['values'].pop('ava',None)
        peer_data['values']['money']['amounts']={str(i):0 for i in range(1,6)}
        templates=request(peer,'/api/templates')['templates'];template=next(t['id'] for t in templates if t['name']=='DND5')
        peer_uuid=request(peer,'/api/chars',{'templateId':template,'sourceVersionId':fixture['edition']['id'],'data':peer_data})['uuid']
        created_session=request(master,'/api/sessions',{'name':'Parity Session','systemId':1,'sourceVersionId':fixture['edition']['id']})
        session=created_session['uuid'];session_id=created_session['id']
        for opener,identity in [(owner,own),(peer,peer_uuid)]:
            char_id=next(row['id'] for row in request(opener,'/api/chars')['chars'] if row['uuid']==identity)
            request(opener,'/api/sessions/'+session+'/join',{'charId':char_id,'replaceExisting':False})
        build_install(device,root,url,output)
        device.shell('wm','density','160');device.shell('wm','size','390x900');login(device,fixture)
        click('Открыть меню',True);click('Персонажи');click('PartyHero')
        click('Parity Session');click('Чат и вызовы')
        device.wait('Сообщение');text('HelloPeer');click('Отправить')
        def conversations():return request(peer,f'/api/char/{peer_uuid}/interactions?sessionUuid={session}&peer={own}')['events']
        wait(lambda:any(e.get('data',{}).get('message')=='HelloPeer' for e in conversations()),'chat')
        checkpoint('chat message')
        click('Камень / ножницы / бумага')
        wait(lambda:any(e['type']=='rps_challenge' for e in conversations()),'challenge')
        event=next(e for e in conversations() if e['type']=='rps_challenge')
        request(peer,f'/api/char/{peer_uuid}/interactions/{event["id"]}/resolve',{'decision':'accept'})
        click('Камень')
        wait(lambda:any(e['id']==event['id'] and e['data'].get('senderReady') for e in conversations()),'sender choice')
        request(peer,f'/api/char/{peer_uuid}/interactions/{event["id"]}/resolve',{'decision':'scissors'})
        device.wait('Вы победили')
        checkpoint('rock paper scissors complete round')
        click('Игроки');click('Передать деньги')
        device.wait('Получатель');click('PeerHero');text('3');click('Применить')
        wait(lambda:document(owner,own)['data']['values']['money']['amounts']['1']==7 and
            document(peer,peer_uuid)['data']['values']['money']['amounts']['1']==3,'money transfer')
        checkpoint('atomic money transfer')
        click('Магия',True)
        click('Действия с записью: '+fixture['recordName'],True);click('Сотворить')
        device.wait('Сотворение заклинания')
        pools=document(owner,own)['data']['values']['spells']['slot_pools']
        before=next(s['used'] for s in pools['long_rest'] if s['level']==1)
        click('Применить')
        wait(lambda:next(s['used'] for s in document(owner,own)['data']['values']['spells']['slot_pools']['long_rest'] if s['level']==1)==before+1,'spell slot')
        checkpoint('spell casting spends one slot')
    finally:
        if session_id:request(master,'/api/sessions/'+str(session_id),method='DELETE')
        request(owner,'/api/char/'+own,method='DELETE')
        if peer_uuid:request(peer,'/api/char/'+peer_uuid,method='DELETE')
        if document(owner,original)['data']!=original_data:raise AssertionError('Session scenario changed original character')
    (output/'session-actions.json').write_text(json.dumps({'passed':True,'realCompose':True,'realAPI':True,'fixtureRestored':True,'actions':checks},ensure_ascii=False,indent=2))
