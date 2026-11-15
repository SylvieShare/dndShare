import { test,expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'

function creature(uid,name,position,index){return{uid,type:'npc',itemId:null,override:{name,hp:20,ac:14},position,initiative:18-index,hpCurrent:14-index,hpTemp:0,hpDsSuccess:0,hpDsFailure:0,surprised:false,tieBreak:0,markerLetter:String.fromCharCode(65+index)}}
async function open(page,width){
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:932})
  const encounter={active:true,round:3,turnIndex:0,combatants:[creature('guard','Страж','combat',0),creature('wolf','Волк','reserve',1),creature('fox','Лиса','reserve',2)]}
  const api=await sessionLayout(page,{url:'/sessions/test',participants:[],encounter})
  await expect(page.locator('.chapter-canvas-stage')).toHaveCSS('background-image',/radial-gradient/)
  await page.getByRole('button',{name:/Открыть бой/}).click()
  await expect(page.locator('.enc-wrap--workspace')).toBeVisible()
  await expect(page.locator('.chapter-canvas-stage')).toHaveCSS('background-image','none')
  const nav=page.getByRole('navigation',{name:'Боковые вкладки сессии'}),sidebar=page.locator('aside.map-sidebar')
  await nav.getByRole('button',{name:'Запас',exact:true}).click()
  await expect(sidebar.locator('.enc-row-shell')).toHaveCount(2)
  return{api,nav,sidebar}
}
function core(data){
  const value=structuredClone(data);delete value.reserveTabs
  for(const row of value.combatants)delete row.reserveTabId
  return value
}

for(const width of [475,704,1440])test(`reserve sidebar tabs create rename and retain NPCs at ${width}`,async({page},info)=>{
  const {api,nav,sidebar}=await open(page,width),before=core(api.encounter())
  await expect(nav.getByRole('separator',{name:'Запасы существ',exact:true})).toBeVisible()
  await expect(sidebar.getByRole('button',{name:'Удалить вкладку',exact:true})).toHaveCount(0)
  await expect(sidebar.getByRole('button',{name:'Переименовать вкладку',exact:true})).toHaveCount(0)
  const add=nav.getByRole('button',{name:'Добавить вкладку',exact:true})
  expect(await add.evaluate(node=>getComputedStyle(node).borderStyle)).toBe('dashed')
  await add.click()
  const name=sidebar.getByRole('textbox',{name:'Название вкладки запаса',exact:true})
  await name.fill('Волки');await name.press('Enter')
  await expect(nav.getByRole('button',{name:'Волки',exact:true})).toBeVisible()
  await expect.poll(()=>api.encounter().reserveTabs?.[0]?.name).toBe('Волки')
  const id=api.encounter().reserveTabs[0].id
  await sidebar.getByRole('button',{name:'Переименовать вкладку',exact:true}).click()
  await name.fill('Не сохранять');await name.press('Escape')
  await expect(nav.getByRole('button',{name:'Волки',exact:true})).toBeVisible()
  expect(api.encounter().reserveTabs[0].name).toBe('Волки')
  await nav.getByRole('button',{name:'Запас',exact:true}).click()
  await sidebar.getByText('Волк',{exact:true}).click()
  const menu=page.getByRole('menu',{name:'Действия существа',exact:true})
  await menu.getByRole('menuitem',{name:'Другой запас',exact:true}).click()
  await page.getByRole('menuitem',{name:'Волки',exact:true}).click()
  await expect.poll(()=>api.encounter().combatants.find(row=>row.uid==='wolf').reserveTabId).toBe(id)
  await expect(sidebar.getByText('Волк',{exact:true})).toHaveCount(0)
  await nav.getByRole('button',{name:'Волки',exact:true}).click()
  await expect(nav.getByRole('button',{name:'Волки',exact:true})).toHaveAttribute('aria-current','page')
  await expect(sidebar.getByText('Волк',{exact:true})).toBeVisible()
  await expect(page.locator('.enc-wrap--workspace .enc-block--npc')).toHaveCount(0)
  expect(core(api.encounter())).toEqual(before)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await info.attach(`reserves-${width}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'})
  if(width===704){
    await page.reload()
    await expect(page.locator('.enc-wrap--workspace')).toBeVisible()
    await nav.getByRole('button',{name:'Волки',exact:true}).click()
    await expect(sidebar.getByText('Волк',{exact:true})).toBeVisible()
    await sidebar.getByRole('button',{name:'Удалить вкладку',exact:true}).click()
    const dialog=page.getByRole('dialog',{name:'Удалить вкладку запаса?',exact:true})
    await expect(dialog).toContainText('Все существа сохранятся')
    await dialog.getByRole('button',{name:'Удалить вкладку',exact:true}).click()
    await expect(nav.getByRole('button',{name:'Волки',exact:true})).toHaveCount(0)
    await expect.poll(()=>api.encounter().reserveTabs.length).toBe(0)
    await expect(sidebar.locator('.enc-row-shell')).toHaveCount(2)
    expect(core(api.encounter())).toEqual(before)
    expect(api.encounter().combatants.every(row=>!row.reserveTabId)).toBe(true)
    await page.reload()
    await expect(nav.getByRole('button',{name:'Запас',exact:true})).toBeVisible()
    await expect(nav.getByRole('button',{name:'Волки',exact:true})).toHaveCount(0)
  }
})

test('reserve writes stay disabled after the initial encounter GET fails',async({page})=>{
  const {api,nav}=await open(page,704)
  expect(api.writes).toHaveLength(0)
  await page.route(url=>url.pathname==='/api/sessions/test/encounter',route=>route.request().method()==='GET'?route.fulfill({status:503,json:{desc:'Unavailable'}}):route.fallback())
  await page.reload()
  await expect(page.locator('.enc-wrap--workspace')).toBeVisible()
  await expect(nav.getByRole('button',{name:'Добавить вкладку',exact:true})).toBeDisabled()
  expect(api.writes).toHaveLength(0)
})
