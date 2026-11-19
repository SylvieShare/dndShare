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
 const items=core.items.map((i,index)=>({id:index+1000,typeId:i.kind==='cyberware'?101:100,name:i.name,nameEn:i.nameEn,coverImageUrl:i.kind==='role'?cover:undefined,data:{red_key:i.key,red_kind:i.kind,price_eb:i.facts.price,facts:i.facts},contentSources:[{page:i.page}]}))
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
   '/api/sources':{sources:[{id:1,name:'DND5e',versions:[{id:1,sourceId:1,version:'2014'}]},{id:2,name:'Vampire: TM',versions:[{id:20,sourceId:2,version:'V20'}]},{id:3,name:'Cyberpunk',versions:[{id:30,sourceId:3,version:'RED'}]}]},
   '/api/templates':{templates:[{id:1,name:'DND5'},{id:2,name:'VTM20'},{id:3,name:'CYBERPUNK_RED'}]},
   '/api/cyberpunk-red/catalogue':{items,revision:core.revision,groups:core.groups},
   '/api/chars':{chars:[response()],sessionsByChar:{}},
   '/api/item-types':{types:[{id:100,name:'Снаряжение',iconImageUrl:cover,coverImageUrl:cover},{id:101,name:'Киберимпланты',iconImageUrl:cover,coverImageUrl:cover}]},
   '/api/items/by-ids':{items:[]},
   '/api/suggest/types':{items:[{id:36,name:'Методы создания'},{id:34,name:'Характеристики',coverImageUrl:cover},{id:38,name:'Навыки',coverImageUrl:cover}]},
   '/api/suggest/36':{items:[{code:'complete',coverImageUrl:cover}]},
   '/api/suggest/batch':{items:{
    34:core.dictionaries['Характеристики'].map(stat=>({code:stat.key,value:stat.name,desc:stat.description,iconImageUrl:cover})),
    38:core.dictionaries['Навыки'].map(skill=>({code:skill.key,value:skill.name,desc:skill.description,iconImageUrl:cover})),
   }},'/api/sessions/active':{sessions:[]},
   '/api/account/tutorials':{tutorials:['mobile','desktop'].map(device=>({flowId:'character',sourceKey:'edition:30',device,status:'completed',revision:58}))},[`/api/char/${uuid}/sessions`]:{sessions:[]},[`/api/char/${uuid}/history`]:{changes:[]},
  }[path]||{}})
 })
 return {getData:()=>data,getRolls:()=>rolls}
}

test('D&D and RED share the creation header actions and responsive step rail', async ({ page }, info) => {
  await fixture(page)
  await page.route('**/api/sources', route => route.fulfill({ json: { sources: [
    { id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }, { id: 2, version: '2024' }] },
    { id: 3, name: 'Cyberpunk', versions: [{ id: 30, version: 'RED' }] },
  ] } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  await page.setViewportSize({ width: 475, height: 751 })
  const rail = page.getByRole('navigation', { name: 'Шаги создания персонажа' })
  const header = page.locator('.cc-head')
  const reset = header.getByRole('button', { name: 'Начать создание сначала', exact: true })
  const incomplete = header.getByRole('button', { name: 'Создать неполноценного', exact: true })
  const current = rail.locator('[aria-current="step"]')
  const step = name => rail.getByRole('button', { name: new RegExp(name) })
  for (const [system, active, locked] of [['dnd5e', 'Версия', 'Класс'], ['cyberpunk-red', 'Роль', 'Завершение']]) {
    await page.goto(`/chars/new?system=${system}`)
    await expect(current).toContainText(active)
    await expect(step(locked)).toBeDisabled()
    for (const width of [320, 475, 834, 1440]) {
      await page.setViewportSize({ width, height: 751 })
      await expect(rail).toBeVisible()
      await expect(rail).toHaveCSS('flex-direction', width < 921 ? 'row' : 'column')
      await expect(page.getByRole('button', { name: 'Создать неполноценного', exact: true })).toHaveCount(1)
      await expect(incomplete).toBeEnabled()
      await expect(reset).toHaveCSS('flex-direction', 'column')
      await expect(incomplete).toHaveCSS('flex-direction', 'column')
      await expect.poll(() => page.evaluate(() => {
        const stepRail = document.querySelector('.cc-rail').getBoundingClientRect()
        const main = document.querySelector('.cc-main').getBoundingClientRect()
        return { vertical: stepRail.bottom <= main.top + 1, withinWindow: document.documentElement.scrollWidth <= innerWidth }
      })).toEqual({ vertical: width < 921, withinWindow: true })
      const actionBounds = await Promise.all([incomplete.boundingBox(), reset.boundingBox(), header.locator('.creation-title').boundingBox()])
      const [createBox, resetBox, titleBox] = actionBounds
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(createBox.x)
      expect(createBox.x + createBox.width).toBeLessThanOrEqual(resetBox.x)
      expect(createBox.y).toBeCloseTo(resetBox.y, 0)
      expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(width)
      await info.attach(`${system}-steps-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    }
    await page.setViewportSize({ width: 475, height: 751 })
    const resetDialog = page.getByRole('dialog', { name: system === 'dnd5e' ? 'Начать сначала?' : 'Сбросить черновик RED?' })
    await reset.click()
    await expect(resetDialog).toBeVisible()
    await resetDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    const incompleteDialog = page.getByRole('dialog', { name: system === 'dnd5e' ? 'Создать персонажа?' : 'Создать неполноценного персонажа?' })
    await incomplete.click()
    await expect(incompleteDialog).toBeVisible()
    await incompleteDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    if (system === 'dnd5e') {
      for (const edition of ['2024', '2014']) {
        await page.getByRole('button', { name: new RegExp(`^${edition}`) }).click()
        await step('Раса').click()
        await expect(current).toContainText('Раса')
        await expect(step('Класс')).toBeDisabled()
        await page.reload()
        await expect(current).toContainText('Раса')
        await step('Версия').click()
        await expect(page.locator('.ver.on')).toContainText(edition)
      }
    } else {
      await step('Жизненный путь').click()
      await step('Способ создания').click()
      await step('Характеристики').click()
      await expect(current).toContainText('Характеристики')
      await page.setViewportSize({ width: 390, height: 751 })
      await expect.poll(() => rail.evaluate(node => {
        const viewport = node.getBoundingClientRect()
        const button = node.querySelector('[aria-current="step"]').getBoundingClientRect()
        return button.left >= viewport.left - 1 && button.right <= viewport.right + 1
      })).toBe(true)
    }
  }
})

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
  await page.goto('/chars')
  await page.getByRole('button',{name:'Новый персонаж',exact:true}).click()
  const menu=page.getByRole('menu',{name:'Выбрать игровую систему'})
  if(width===1440){
   await menu.getByRole('menuitem',{name:'Vampire V20',exact:true}).click()
   await expect(page.getByPlaceholder('Введите имя...')).toBeVisible()
   await expect(page.getByRole('option',{name:'VTM20'})).toHaveCount(0)
   await page.getByRole('button',{name:'Отмена',exact:true}).click()
   await expect(page.getByPlaceholder('Введите имя...')).toHaveCount(0)
   await page.getByRole('button',{name:'Новый персонаж',exact:true}).click()
  }
  await menu.getByRole('menuitem',{name:'D&D 5e',exact:true}).click()
  await expect(page.getByText('Версия правил',{exact:true})).toBeVisible()
  await page.goBack()
  await page.getByRole('button',{name:'Новый персонаж',exact:true}).click()
  await menu.getByRole('menuitem',{name:'Cyberpunk RED',exact:true}).click()
  const rail=page.getByRole('navigation',{name:'Шаги создания персонажа'})
  await expect(rail.locator('.rail-title').filter({hasText:/^(Роль|Жизненный путь|Способ создания)$/})).toHaveText(['Роль','Жизненный путь','Способ создания'])
  const main=page.locator('.red-wizard-main')
  const solo=main.getByRole('button',{name:'Соло',exact:true})
  if(width===1440){
   await main.getByRole('button',{name:'Техник',exact:true}).click()
   await page.getByRole('button',{name:'Изменить',exact:true}).click()
   await expect(main.getByText('Полевая экспертиза',{exact:true})).toBeVisible()
   await main.getByRole('button',{name:/К выбору роли/}).click()
   await solo.click()
   await page.getByRole('button',{name:'Изменить',exact:true}).click()
   await main.getByRole('button',{name:/К выбору роли/}).click()
  }
  await expect(solo.locator('img')).toHaveJSProperty('naturalWidth',50)
  await expect(main.getByText('Специальности роли',{exact:true})).toHaveCount(0)
  await solo.click()
  await expect(main.getByText('Специальности роли',{exact:true})).toBeVisible()
  await expect(main.locator('.role-description')).toContainText('Боевое чутьё')
  await expect(main.locator('.role-description .tile-accent-strip')).toBeVisible()
  await expect(solo.locator('.background-card-description')).toHaveCount(0)
  await expect(main.getByRole('button',{name:'Техник',exact:true})).toHaveCount(0)
  const initiative=main.getByRole('spinbutton').nth(2)
  await initiative.fill('1')
  await initiative.blur()
  await testInfo.attach(`wizard-${width}`,{body:await page.screenshot({animations:'disabled',timeout:10000}),contentType:'image/png'})
  await main.getByRole('button',{name:/К выбору роли/}).click()
  await expect(solo).toHaveAttribute('aria-pressed','true')
  await solo.click()
  await expect(initiative).toHaveValue('1')
  const next=page.getByRole('button',{name:'Далее',exact:true})
  const railStep=name=>rail.locator('.rail-step').filter({has:page.getByText(name,{exact:true})})
  await expect(page.getByRole('button',{name:'Создать неполноценного',exact:true}).filter({visible:true})).toHaveCount(1)
  if(width===1440){
   const precision=main.getByRole('spinbutton').nth(3)
   await precision.fill('2');await precision.blur()
   await expect(page.locator('.red-step-reason')).toHaveText('Превышен бюджет способности роли')
   await expect(next).toBeDisabled()
   await expect(railStep('Жизненный путь')).toBeDisabled()
   await precision.fill('0');await precision.blur()
  }
  await next.click()
  await expect(main.getByRole('heading',{name:'Жизненный путь',exact:true})).toBeVisible()
  if(width===1440){
   const language=main.locator('input').first()
   await language.fill('')
   await expect(next).toBeDisabled()
   await expect(page.locator('.red-step-reason')).toContainText('Укажите родной язык')
   await language.fill('Русский')
  }
  await next.click()
  await expect(page.getByRole('heading',{name:'Способ создания'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Полный пакет',exact:true}).locator('img')).toHaveJSProperty('naturalWidth',50)
  if(width===1440){
   await next.click()
   const first=main.locator('.stat-card').first()
   await expect(main.getByRole('heading',{name:'Полный пакет',exact:true})).toBeVisible()
   await expect(main.locator('.stat-roll-table')).toHaveCount(0)
   await first.getByRole('button',{name:'+',exact:true}).click()
   await expect(page.locator('.red-step-reason')).toContainText('62 очка характеристик')
   await expect(next).toBeDisabled()
   await first.getByRole('button',{name:'−',exact:true}).click()
   await next.click()
   await expect(main.getByRole('heading',{name:'Навыки',exact:true}).first()).toBeVisible()
   await expect(page.locator('.red-step-reason')).toContainText('86 очков навыков')
   await expect(railStep('Магазин')).toBeDisabled()
   const initial=main.locator('.skills-step-specializations')
   await expect(initial.getByRole('heading',{name:'Начальные специализации'})).toBeVisible()
   await expect(initial.locator('input').first()).toBeVisible()
   const concentration=main.locator('.red-skill-card').filter({has:page.getByRole('heading',{name:'Сосредоточение',exact:true})})
   const rankGroup=concentration.getByRole('group',{name:'Ранг навыка «Сосредоточение»'})
   const rank=rankGroup.getByRole('spinbutton')
   const bar=concentration.getByRole('radiogroup',{name:'Шкала ранга навыка «Сосредоточение»'})
   await expect(bar.locator('.rank-segment')).toHaveCount(6)
   await expect(bar.locator('.rank-segment--filled')).toHaveCount(2)
   await bar.locator('.rank-segment').nth(4).click()
   await expect(rank).toHaveValue('5')
   await expect(concentration.locator('.formula-base')).toHaveText('11')
   await expect(bar.locator('.rank-segment--filled')).toHaveCount(5)
   await bar.getByRole('radio',{name:'Ранг 5',exact:true}).press('ArrowLeft')
   await expect(rank).toHaveValue('4')
   await rank.fill('2')
   await rankGroup.getByRole('button',{name:'+',exact:true}).click()
   await expect(concentration.locator('.formula-base')).toHaveText('9')
   await expect(bar.locator('.rank-segment--filled')).toHaveCount(3)
   await rankGroup.getByRole('button',{name:'−',exact:true}).click()
   await expect(concentration.locator('.formula-base')).toHaveText('8')
   await rank.fill('3')
   await expect(concentration.locator('.formula-base')).toHaveText('9')
   await rank.fill('2')
   await expect(concentration.locator('.formula-base')).toHaveText('8')
   const specialties=main.locator('.skill-specialization-form')
   await specialties.getByText('Добавить специализацию',{exact:true}).click()
   await specialties.getByRole('combobox',{name:'Навык для специализации'}).selectOption('language')
   await specialties.getByRole('textbox',{name:'Название специализации'}).fill('Японский')
   await specialties.getByRole('button',{name:'Добавить',exact:true}).click()
   const japanese=main.locator('.red-skill-card').filter({has:page.getByText('Японский',{exact:true})})
   await expect(japanese.getByRole('spinbutton')).toHaveValue('0')
   await railStep('Способ создания').click()
  }
  await page.getByRole('button',{name:'Уличная крыса',exact:true}).click()
  await page.getByRole('button',{name:'Изменить',exact:true}).click()
  await next.click()
  await expect(page.locator('.creation-cover')).toHaveJSProperty('naturalWidth',50)
  const stats=main.locator('.red-creation-stats')
  await expect(stats.locator('.item-icon img')).toHaveCount(10)
  await expect(stats.getByText(core.dictionaries['Характеристики'][0].description)).toBeVisible()
  await expect(stats.locator('.system-die')).toHaveCount(0)
  await expect(stats.locator('.stat-pending')).toHaveCount(10)
  await expect(next).toBeDisabled()
  await expect(railStep('Навыки')).toBeDisabled()
  await stats.getByRole('button',{name:'Бросить d10',exact:true}).click()
  await expect(stats.getByRole('img',{name:/^d10: (?:10|[1-9])$/})).toHaveCount(1)
  await expect(stats.locator('.stat-pending')).toHaveCount(0)
  await expect(stats.locator('.stat-result.stat-flash')).toHaveCount(10)
  if(width===1440){
   await stats.getByText('Таблица характеристик · Соло',{exact:true}).click()
   await expect(stats.locator('tbody tr')).toHaveCount(10)
   await expect(stats.locator('tbody tr').filter({has:page.locator('td.picked')})).toHaveCount(1)
   await expect(stats.locator('td.picked')).toHaveCount(10)
  }
  await expect(next).toBeEnabled()
  const columns=await stats.locator('.stat-grid').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length)
  expect(columns).toBeGreaterThan(1)
  expect(columns).toBeLessThanOrEqual(width===390?2:width===840?3:4)
  await testInfo.attach(`stats-${width}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'})
  await railStep('Навыки').click()
  const skills=main.locator('.red-skills')
  await expect(skills.locator('.skill-stat-card')).toHaveCount(0)
  const skillCards=skills.locator('.red-skill-card')
  await expect(skillCards).toHaveCount(67)
  await expect(skillCards.locator('.skill-identity img')).toHaveCount(67)
  await expect(skillCards.locator('.formula-stat img')).toHaveCount(67)
  await expect(skillCards.locator('.skill-help')).toHaveCount(67)
  await expect(skillCards.first().getByText(/База/)).toBeVisible()
  await expect(skills.locator('.skill-group .tile-accent-strip').first()).toBeVisible()
  await expect(skillCards.first().getByRole('meter')).toBeVisible()
  const skillColumns=await skills.locator('.skill-card-grid').first().evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').filter(col=>col!=='0px').length)
  expect(skillColumns).toBe(width===1440?2:1)
  const formulaPosition=await skillCards.first().evaluate(card=>{
   const title=card.querySelector('.skill-identity').getBoundingClientRect()
   const formula=card.querySelector('.skill-formula').getBoundingClientRect()
   return formula.left>=title.right?'right':'below'
  })
  expect(formulaPosition).toBe(width===390?'below':'right')
  await expect(skills.getByRole('textbox',{name:'Найти навык'})).toHaveCount(0)
  await skills.getByRole('combobox',{name:'Группа навыков'}).selectOption({label:'Восприятие'})
  await expect(skills.locator('.skill-group h3')).toHaveText(['Восприятие'])
  await expect(skillCards.first()).toContainText('Сосредоточение')
  const help=skillCards.first().getByRole('button',{name:'Описание навыка «Сосредоточение»'})
  await help.click()
  const skillDescription=page.getByRole('dialog',{name:'Сосредоточение'})
  await expect(skillDescription).toContainText('Удерживать внимание под давлением')
  await page.keyboard.press('Escape')
  await expect(skillDescription).toHaveCount(0)
  if(width===1440){
   const longTitle=skills.getByRole('heading',{name:'Спрятать / обнаружить предмет',exact:true})
   await expect(longTitle).toHaveAttribute('data-fit-ready','')
   expect(await longTitle.evaluate(title=>title.clientWidth)).toBeGreaterThan(90)
   const scale=Number(await longTitle.getAttribute('data-fit-scale'))
   expect(scale).toBeGreaterThanOrEqual(.66)
   expect(scale).toBeLessThan(1)
   await expect(skillCards.first().locator('.skill-title-fit')).toHaveAttribute('data-fit-wrapping','false')
  }
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await rail.getByText('Магазин',{exact:true}).click()
  await expect(page.getByRole('heading',{name:'Магазин',exact:true})).toBeVisible()
  await expect(main.locator('.shop-summary .kit-panel')).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const widthOfBorder = await main.evaluate(node => getComputedStyle(node).borderLeftWidth)
  expect(widthOfBorder).toBe(width <= 640 ? '0px' : '1px')
  const shop=main.locator('.wizard-shop')
  await shop.locator('.categories').getByRole('button',{name:/Киберимпланты/}).click()
  await expect(shop.locator('.categories button[aria-pressed=true] img')).toHaveAttribute('src',cover)
  await expect(shop.locator('.wealth-copy img[alt="евродоллары"]')).toHaveJSProperty('naturalWidth',128)
  await shop.locator('.shop-add').first().click()
  await expect(shop.locator('.cart-price img[alt="евродоллары"]')).toBeVisible()
  await expect(shop.getByText('Расположение',{exact:true})).toBeVisible()
  await shop.getByRole('button',{name:'Убрать',exact:true}).click()
  await rail.getByText('Завершение',{exact:true}).click()
  await expect(page.getByRole('button',{name:'Создать персонажа',exact:true})).toBeDisabled()
  await expect(main.getByRole('heading',{name:'Готовность персонажа'})).toBeVisible()
  await main.getByRole('textbox').fill('Новый RED')
  await page.getByRole('button',{name:'Создать персонажа',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/char/${uuid}$`))
  expect(state.getData().values.creation.complete).toBe(true)
  expect(state.getData().values.roles[0].choices.initiative).toBe(1)
  expect(state.getData().values.inventory.entries.length).toBeGreaterThan(10)
  if(width===1440){await page.goto(`/char/${uuid}/print`);await expect(page.locator('.red-print')).toBeVisible();await expect(page.locator('.rp-skills>div')).toHaveCount(67);await page.pdf({path:testInfo.outputPath('red-character-sheet.pdf'),format:'A4',printBackground:true})}
  expect(errors).toEqual([])
 })
}

test('RED restores the original screen of a saved wizard draft', async ({page}) => {
  await fixture(page)
  const storageKey = 'dndshare.red-create.v1'
  const draft = {
    schemaVersion: 1,
    method: 'complete',
    role: 'solo',
    name: 'Старый черновик',
    lifepath: { goal: 'Найти экипаж' },
  }
  await page.addInitScript(({storageKey,draft}) => {
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey,JSON.stringify({draft,step:2}))
    }
  },{storageKey,draft})
  await page.goto('/chars/new?system=cyberpunk-red')
  const main = page.locator('.red-wizard-main')
  await expect(main.getByRole('heading',{name:'Жизненный путь',exact:true})).toBeVisible()
  await expect(main.locator('input').filter({visible:true}).last()).toBeVisible()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),storageKey)
  expect(saved.stepKey).toBe('lifepath')
  expect(saved.draft).toMatchObject({...draft,schemaVersion:2})
  await page.reload()
  await expect(main.getByRole('heading',{name:'Жизненный путь',exact:true})).toBeVisible()
})

test('RED blocks incompatible implants and can save an incomplete sheet', async ({page}) => {
  const state = await fixture(page)
  const storageKey = 'dndshare.red-create.v1'
  const options = {nativeLanguage:'Русский',specializations:{science:'Биология','play-instrument':'Гитара'}}
  const draft = {
    ...options,
    schemaVersion:2,
    method:'complete',
    role:'solo',
    name:'',
    stats:{INT:6,REF:8,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:6,EMP:6},
    skills:redInitialSkills('solo','streetrat',options),
    cart:[
      {uid:'gear-test',key:'gear-agent',count:1,pool:'general'},
      {uid:'implant-test',key:'cyberware-teleoptics',count:1,pool:'general'},
    ],
  }
  await page.addInitScript(({storageKey,draft})=>{
    if(!localStorage.getItem(storageKey)) localStorage.setItem(storageKey,JSON.stringify({draft,stepKey:'cyberware'}))
  },{storageKey,draft})
  await page.setViewportSize({width:390,height:950})
  await page.goto('/chars/new?system=cyberpunk-red')
  const main = page.locator('.red-wizard-main')
  await expect(main.getByRole('heading',{name:'Магазин',exact:true})).toBeVisible()
  await expect(page.locator('.red-step-reason')).toContainText('требуется основная установка')
  await expect(page.getByRole('button',{name:'Далее',exact:true})).toBeDisabled()
  const incomplete = page.getByRole('button',{name:'Создать неполноценного',exact:true}).filter({visible:true})
  await incomplete.click()
  await page.getByRole('button',{name:'Отмена',exact:true}).last().click()
  await expect(main.getByRole('heading',{name:'Магазин',exact:true})).toBeVisible()
  await incomplete.click()
  await page.getByRole('button',{name:'Создать',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/char/${uuid}$`))
  const values = state.getData().values
  expect(values.creation.complete).toBe(false)
  expect(values.identity.handle).toBe('Новый персонаж')
  expect(values.stats).toEqual(draft.stats)
  expect(values.inventory.entries.some(entry=>entry.key==='gear-agent')).toBe(true)
  expect(values.cyberware.installations).toEqual([])
})

test('RED replaces legacy placeholder dice with ten explicit Edgerunner rolls', async ({page}) => {
  await fixture(page)
  const storageKey = 'dndshare.red-create.v1'
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) {
      const draft = {schemaVersion:1,method:'edgerunner',role:'solo',statRolls:Array(10).fill(1)}
      localStorage.setItem(key,JSON.stringify({draft,stepKey:'stats'}))
    }
  },storageKey)
  await page.goto('/chars/new?system=cyberpunk-red')
  const stats = page.locator('.red-creation-stats')
  await expect(stats.getByText('Сделай бросок, чтобы получить характеристики.')).toBeVisible()
  await expect(stats.locator('.system-die')).toHaveCount(0)
  await page.evaluate(() => { Math.random = () => 0.51 })
  await stats.getByRole('button',{name:'Бросить 10d10',exact:true}).click()
  await expect(stats.locator('.stat-card .system-die')).toHaveCount(10)
  await expect(stats.getByRole('img',{name:'d10: 6',exact:true})).toHaveCount(10)
  await stats.getByText('Таблица характеристик · Соло',{exact:true}).click()
  await expect(stats.locator('tbody tr').nth(5).locator('td.picked')).toHaveCount(10)
  const original = await stats.locator('.stat-result strong').allTextContents()
  expect(await stats.locator('td.picked').allTextContents()).toEqual(original)
  const reroll=stats.getByRole('button',{name:'Перебросить',exact:true})
  await reroll.click()
  await expect(page.getByText(/Перебрасывают броски слабые духом/)).toBeVisible()
  await page.getByRole('button',{name:'Отмена',exact:true}).click()
  await expect(stats.getByRole('img',{name:'d10: 6',exact:true})).toHaveCount(10)
  await page.evaluate(() => { Math.random = () => 0.21 })
  await reroll.click()
  await page.getByRole('button',{name:'Да, мне не стыдно',exact:true}).click()
  await expect(stats.getByRole('img',{name:'d10: 3',exact:true})).toHaveCount(10)
  await expect(stats.locator('tbody tr').nth(2).locator('td.picked')).toHaveCount(10)
  expect(await stats.locator('td.picked').allTextContents()).not.toEqual(original)
  await expect(stats.locator('.stat-flash')).toHaveCount(10)
  const results = await stats.locator('.stat-card .system-die').evaluateAll(dice=>dice.map(die=>die.getAttribute('aria-label')))
  await page.reload()
  await expect(stats.locator('.stat-card .system-die')).toHaveCount(10)
  expect(await stats.locator('.stat-card .system-die').evaluateAll(dice=>dice.map(die=>die.getAttribute('aria-label')))).toEqual(results)
})
