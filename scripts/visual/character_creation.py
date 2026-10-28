"""Full 2024 wizard through Compose, with independent repeated feat instances and a real API."""
import http.cookiejar
import json
import re
import time
import urllib.parse
import urllib.request

from android import build_install, login


def creation_actions(device, root, url, output, fixture):
    if urllib.parse.urlparse(url).hostname!='127.0.0.1' or fixture['login']!='native_tester':
        raise ValueError('Creation checks require the disposable loopback fixture')
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path,data=None,method=None):
        call=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json'})
        with opener.open(call,timeout=25) as response:
            raw=response.read();return json.loads(raw) if raw else None
    request('/api/user/auth',{key:fixture[key] for key in ('login','password')})
    originals={row['uuid'] for row in request('/api/chars')['chars']}
    created=[];checks=[]
    def checkpoint(label):
        checks.append(label);print('native creation: '+label,flush=True)
        (output/'creation-progress.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    def scroll(tree,reverse=False):
        rows=[n for n in tree.iter('node') if n.get('scrollable')=='true' and n.get('class')!='android.widget.HorizontalScrollView']
        if not rows:return
        left,top,right,bottom=map(int,re.findall(r'\d+',rows[-1].get('bounds','')))
        x=(left+right)//2
        device.shell('input','swipe',str(x),str(top+24 if reverse else bottom-24),str(x),str(bottom-24 if reverse else top+24),'250')
    def find(label,description=False,tap=True):
        key='content-desc' if description else 'text'
        for reverse in (False,True):
            previous=None
            for _ in range(16):
                tree=device.tree();nodes=[n for n in tree.iter('node') if n.get(key)==label]
                if nodes:
                    if tap:device.tap(nodes[-1])
                    return nodes[-1]
                current=tuple((n.get('text'),n.get('content-desc'),n.get('bounds')) for n in tree.iter('node'))
                if current==previous:break
                previous=current;scroll(tree,reverse)
        raise AssertionError('Missing creator control: '+label)
    try:
        build_install(device,root,url,output)
        device.shell('wm','density','160');device.shell('wm','size','390x900');login(device,fixture)
        find('Открыть меню',True);find('Персонажи');find('Новый персонаж',True)
        find('2024');find('Дальше')
        find('Эльф');find('Обучение');find('Сила');find('Дальше')
        find('Учебный класс');find('Дальше')
        find('Учебная предыстория');find('Комплект');find('Ловкость');find('Дальше')
        checkpoint('edition, race, class and background retain separate choices for the same repeatable feat')
        find('Покупка очков')
        find('Сила: прибавка предыстории +2',True);find('Телосложение: прибавка предыстории +1',True)
        find('Дальше')
        name=find('Имя персонажа',True)
        device.tree()
        device.shell('input','text','CreationHero')
        if 'mInputShown=true' in device.shell('dumpsys','input_method'):device.shell('input','keyevent','4')
        find('Мировоззрение',True);find('Нейтрально-добрый');find('Создать')
        device.wait(description='К списку персонажей')
        rows=[row for row in request('/api/chars')['chars'] if row['uuid'] not in originals]
        created.extend(row['uuid'] for row in rows)
        assert len(rows)==1
        result=request('/api/char/'+rows[0]['uuid'])
        values=result['data']['values']
        assert values['name']=='CreationHero' and result['sourceVersionId']==3
        feats=values['abilities_feats']
        assert len(feats)==2 and feats[0]['uid']!=feats[1]['uid']
        assert feats[0]['choices']['focus']==[1] and feats[1]['choices']['focus']==[2]
        assert all(row['count']==2 and row['resource_version']==1 for row in feats)
        assert values['STR']['save_up'] is True and values['DEX']['save_up'] is True
        assert values['person_alignment']=='Нейтрально-добрый' and 'spells' not in values
        assert values['STR']['value']['base']==8 and values['DEX']['value']['base']==8
        checkpoint('full native creation commits independent choices, resources and canonical alignment to the server')
        device.shell('am','force-stop','ru.dndshare.client.smoke')
        device.shell('am','start','-W','-n','ru.dndshare.client.smoke/ru.dndshare.client.MainActivity')
        device.wait('Основные разделы')
        assert request('/api/char/'+rows[0]['uuid'])['data']==result['data']
        checkpoint('creation survives restart without creating a second character')
    finally:
        current=request('/api/chars')['chars']
        for row in current:
            if row['uuid'] not in originals:request('/api/char/'+row['uuid'],method='DELETE')
    (output/'creation-actions.json').write_text(json.dumps({'passed':True,'realCompose':True,'realAPI':True,'actions':checks},ensure_ascii=False,indent=2))
