"""Identity, manual classes, wallet calculator and guarded undo through real Compose/Room/API."""
import http.cookiejar
import json
import urllib.parse
import urllib.request

from android import build_install, login
from native_controls import NativeControls


def identity_actions(device, root, url, output, fixture):
    if urllib.parse.urlparse(url).hostname!='127.0.0.1' or fixture['login']!='native_tester':
        raise ValueError('Identity checks require the disposable loopback fixture')
    owner=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path,data=None,method=None):
        call=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,
                                   method=method,headers={'Content-Type':'application/json'})
        with owner.open(call,timeout=25) as response:
            raw=response.read();return json.loads(raw) if raw else None
    request('/api/user/auth',{k:fixture[k] for k in ('login','password')})
    original=fixture['characters'][0]['uuid'];before=request('/api/char/'+original)['data']
    clone=request('/api/char/'+original+'/clone',{},'POST')['uuid']
    controls=NativeControls(device);checks=[]
    def values():return request('/api/char/'+clone)['data']['values']
    def checkpoint(label):
        checks.append(label);print('native identity: '+label,flush=True)
        (output/'identity-progress.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    def select_book():
        tree=device.tree()
        if any(n.get('content-desc')=='К списку персонажей' for n in tree.iter('node')):
            controls.click('К списку персонажей',True)
        else:
            controls.click('Открыть меню',True);controls.click('Персонажи')
        controls.click('IdentityHero');controls.click('База',True)
    try:
        build_install(device,root,url,output)
        device.shell('wm','density','160');device.shell('wm','size','390x900');login(device,fixture)
        controls.click('Открыть меню',True);controls.click('Персонажи')
        controls.click(fixture['characters'][0]['name']+' (копия)');controls.click('База',True)
        controls.click(fixture['characters'][0]['name']+' (копия)')
        controls.enter('Имя','IdentityHero')
        controls.click('Эльф');controls.click('Человек')
        controls.click('Без происхождения');controls.click('Северянин')
        controls.click('Редактировать классы')
        controls.enter('Уровень класса','2');controls.keyboard_close()
        controls.click('+ Добавить класс');controls.click('Выбрать класс');controls.click('Воин')
        controls.click('Без подкласса');controls.click('Школа стража')
        controls.click('Сохранить')
        controls.wait(lambda:values()['name']=='IdentityHero','identity save')
        current=values()
        assert current['race']=={'id':219,'name':'Человек'} and current['subrace']=={'id':213,'name':'Северянин'}
        assert [(r['id'],r['level']) for r in current['classes']]==[(211,2),(214,1)]
        assert current['classes'][1]['subclass']=={'id':215,'name':'Школа стража'}
        assert current['lvl']['level']==3 and current['lvl']['exp']==before['values']['lvl']['exp']
        for key in ('hp','spells','abilities_feats','weapon'):assert current[key]==before['values'][key]
        assert all('_key' not in row for row in current['classes'])
        checkpoint('race, origin and manual multiclass levels persist atomically without changing health, spells or experience')
        controls.click('Предметы',True);controls.click('Изменить кошелёк',True)
        original_balance=values()['money']['amounts'].get('1',0)
        for key in ('2','*','3'):controls.click('Калькулятор: '+key,True)
        controls.click('Взять');controls.click('Сохранить')
        controls.wait(lambda:values()['money']['amounts'].get('1')==original_balance+6,'calculator save')
        assert not any(key.startswith('_calc') for key in values()['money']['amounts'])
        checkpoint('wallet calculator updates the selected currency and does not persist its UI fields')
        controls.click('База',True);controls.click('Меню')
        controls.click('Отменить изменение')
        controls.wait(lambda:values()['money']['amounts'].get('1')==original_balance,'undo acknowledgement')
        controls.click('Повторить изменение')
        controls.wait(lambda:values()['money']['amounts'].get('1')==original_balance+6,'redo acknowledgement')
        assert values()['lvl']['level']==3
        checkpoint('native undo and redo queue the wallet change through the versioned API and keep the previous identity edit')
        device.shell('input','keyevent','4')
        controls.click('18');controls.enter('Текущие хиты','0');controls.keyboard_close();controls.click('Сохранить')
        controls.wait(lambda:values()['hp']['current']==0,'zero health save')
        device.shell('wm','size','834x1100')
        controls.click('Успехи: 3',True)
        controls.wait(lambda:values()['hp']['current']==1,'third success restores consciousness')
        assert values()['hp']['ds_success']==0 and values()['hp']['ds_failure']==0
        checkpoint('inline death saves restore one health and clear both counters atomically')
        device.shell('wm','size','390x900')
        device.shell('am','force-stop','ru.dndshare.client.smoke')
        device.shell('am','start','-W','-n','ru.dndshare.client.smoke/ru.dndshare.client.MainActivity')
        select_book();controls.click('IdentityHero');controls.click('Редактировать классы')
        controls.find('Воин');controls.find('Школа стража')
        controls.click('Отмена')
        assert values()['money']['amounts']['1']==original_balance+6
        checkpoint('process restart restores the full identity and manual class state')
    finally:
        request('/api/char/'+clone,method='DELETE')
        assert request('/api/char/'+original)['data']==before
    (output/'identity-actions.json').write_text(json.dumps({'passed':True,'realCompose':True,'realAPI':True,
        'fixtureRestored':True,'actions':checks},ensure_ascii=False,indent=2))
