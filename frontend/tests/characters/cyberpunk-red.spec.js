import {test,expect} from '@playwright/test'
import fs from 'node:fs'
import {applyDocumentPatches} from '../../src/shared/lib/documentPatch.js'
import {redInitialSkills,redStatsFromRolls} from '../../src/features/character-editor/settings/cyberpunk-red/creation.js'
import {finishRedCreation} from '../../src/features/character-editor/settings/cyberpunk-red/equipment.js'
import {RED_STARTING_KITS} from '../../src/features/character-editor/settings/cyberpunk-red/startingKits.js'

const core=JSON.parse(fs.readFileSync(new URL('../../../internal/cyberpunkred/core.json',import.meta.url),'utf8'))
const uuid='c0000000-0000-4000-8000-000000000001'
const cover='/test-red-cover.svg'
async function fixture(page){
 const options={nativeLanguage:'Русский',specializations:{science:'Биология','play-instrument':'Гитара'}}
 let data=finishRedCreation({...options,name:'STATIC',role:'netrunner',method:'streetrat',stats:redStatsFromRolls('netrunner','streetrat',[6]),statRolls:[6],skills:redInitialSkills('netrunner','streetrat',options),kitChoices:Object.fromEntries(RED_STARTING_KITS.netrunner.filter(r=>r.choice).map(r=>[r.choice,0])),cart:[]},core.items)
 let version=1;const rolls=[]
 const response=()=>({uuid,id:1,templateId:3,templateName:'CYBERPUNK_RED',sourceName:'Cyberpunk',sourceId:3,sourceVersionId:30,sourceVersion:'RED',version,userId:1,publicVisible:true,data})
 const items=core.items.map((i,index)=>({id:index+1000,typeId:100,name:i.name,nameEn:i.nameEn,coverImageUrl:i.kind==='role'?cover:undefined,data:{red_key:i.key,red_kind:i.kind,price_eb:i.facts.price,facts:i.facts},contentSources:[{page:i.page}]}))
 await page.route('**/test-red-cover.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="20"><rect width="50" height="20" fill="teal"/></svg>'}))
 await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
  if(path===`/api/char/${uuid}`)return route.fulfill({json:response()})
  if(path===`/api/char/${uuid}/data`&&method==='PATCH'){
   const body=request.postDataJSON();const fromVersion=version
   if(body.baseVersion!==version)return route.fulfill({status:409,json:{type:'conflict',desc:'Version mismatch'}})
   data=applyDocumentPatches(data,body.patches);version++
   return route.fulfill({json:{fromVersion,version,mutationId:body.mutationId,patches:body.patches}})
  }
  if(path===`/api/char/${uuid}/red-roll`&&method==='POST'){const r=request.postDataJSON();rolls.push(r);version++;return route.fulfill({json:{version,eventId:0,roll:{title:r.title,total:18,base:12,dice:[6],expression:'1d10+12'}}})}
  if(path===`/api/char/${uuid}/changes`)return route.fulfill({json:{version,data,patches:[]}})
  if(path==='/api/chars'&&method==='POST'){data=request.postDataJSON().data;version=1;return route.fulfill({json:{uuid,charId:1}})}
  return route.fulfill({json:{
   '/api/build-info':{backend:{version:'test',build:1,apiContract:1},frontend:{version:'0.0.0',build:0}},
   '/api/user/checkAuth':{auth:true,user:{id:1,login:'red-test',roles:[],hasCharacters:true,gameContext:{sourceVersionId:30}}},
   '/api/sources':{sources:[{id:1,name:'DND5e',versions:[{id:1,sourceId:1,version:'2014'}]},{id:3,name:'Cyberpunk',versions:[{id:30,sourceId:3,version:'RED'}]}]},
   '/api/templates':{templates:[{id:1,name:'DND5'},{id:3,name:'CYBERPUNK_RED'}]},
   '/api/cyberpunk-red/catalogue':{items,revision:core.revision,groups:core.groups},
   '/api/chars':{chars:[response()],sessionsByChar:{}},
   '/api/item-types':{types:[{name:'Киберимпланты',coverImageUrl:cover}]},
   '/api/items/by-ids':{items:[]},
   '/api/suggest/types':{items:[{id:36,name:'Методы создания'},{id:34,name:'Характеристики',coverImageUrl:cover}]},
   '/api/suggest/36':{items:[{code:'complete',coverImageUrl:cover}]},
   '/api/suggest/batch':{items:{}},'/api/sessions/active':{sessions:[]},
   '/api/account/tutorials':{tutorials:['mobile','desktop'].map(device=>({flowId:'character',sourceKey:'edition:30',device,status:'completed',revision:58}))},[`/api/char/${uuid}/sessions`]:{sessions:[]},[`/api/char/${uuid}/history`]:{changes:[]},
  }[path]||{}})
 })
 return {getData:()=>data,getRolls:()=>rolls}
}
for(const width of [390,840,1440]){
 test(`RED sheet, editing and creation at ${width}`,async({page},testInfo)=>{
  test.setTimeout(120000)
  await page.setViewportSize({width,height:1000})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const state=await fixture(page)
  await page.goto(`/char/${uuid}`)
  await expect(page.locator('.red-sheet').first()).toBeVisible({timeout:25000})
  await expect(page.getByRole('heading',{name:'Защита и здоровье'})).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await testInfo.attach(`sheet-${width}`,{body:await page.screenshot({animations:'disabled',timeout:10000}),contentType:'image/png'})
  await page.getByRole('button',{name:'Инициатива',exact:true}).first().click()
  await page.getByRole('button',{name:'Бросить',exact:true}).click()
  await expect.poll(()=>state.getRolls().length).toBe(1)
  await expect(page.getByText('1d10+12 · кости: 6',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Закрыть',exact:true}).last().click()
  for(const tab of ['Навыки','Бой','Киберимпланты','Сеть','Предметы','Роли и развитие','Личность']){
   await page.locator('.character-workspace-header').getByRole('button',{name:tab,exact:true}).click()
   await expect(page.locator('.red-sheet').first()).toBeVisible()
  }
  await expect(page.getByRole('heading',{name:'Личность',exact:true})).toBeVisible()
  const name=page.locator('input[placeholder="Имя / handle"]:visible')
  await name.fill('STATIC II');await name.blur()
  await expect.poll(()=>state.getData().values.identity.handle).toBe('STATIC II')
  await page.reload()
  await expect(page.locator('.character-heading h1')).toHaveText('STATIC II')
  await page.goto('/chars/new?system=cyberpunk-red')
  await expect(page.getByRole('heading',{name:'Способ создания'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Полный пакет',exact:true}).locator('img')).toHaveJSProperty('naturalWidth',50)
  await page.getByRole('button',{name:'Уличная крыса',exact:true}).click()
  await page.getByRole('button',{name:'Изменить',exact:true}).click()
  const rail=page.getByRole('navigation',{name:'Шаги создания персонажа'})
  await rail.getByText('Роль',{exact:true}).click()
  await expect(page.getByRole('button',{name:'Соло',exact:true}).locator('img')).toHaveJSProperty('naturalWidth',50)
  await testInfo.attach(`wizard-${width}`,{body:await page.screenshot({animations:'disabled',timeout:10000}),contentType:'image/png'})
  await rail.getByText('Характеристики',{exact:true}).click()
  await expect(page.locator('.creation-cover')).toHaveJSProperty('naturalWidth',50)
  await rail.getByText('Киберимпланты',{exact:true}).click()
  await expect(page.getByRole('heading',{name:'Киберимпланты',exact:true})).toBeVisible()
  await expect(page.locator('.creation-cover')).toHaveJSProperty('naturalWidth',50)
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await rail.getByText('Завершение',{exact:true}).click()
  await page.locator('.red-wizard-main input').fill('Новый RED')
  await page.getByRole('button',{name:'Создать персонажа',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/char/${uuid}$`))
  expect(state.getData().values.creation.complete).toBe(true)
  expect(state.getData().values.inventory.entries.length).toBeGreaterThan(10)
  if(width===1440){await page.goto(`/char/${uuid}/print`);await expect(page.locator('.red-print')).toBeVisible();await expect(page.locator('.rp-skills>div')).toHaveCount(67);await page.pdf({path:testInfo.outputPath('red-character-sheet.pdf'),format:'A4',printBackground:true})}
  expect(errors).toEqual([])
 })
}
