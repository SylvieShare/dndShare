import { test,expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout.js'

async function open(page,width,owner=true) {
  await page.setViewportSize({width,height:932})
  page.on('pageerror',error=>{throw error})
  const api=await fixture(page,'DND5',owner)
  const effect={id:951,typeId:15,name:'Отравление',compatibility:[{sourceVersionId:1,status:'native'}],data:{code:'poisoned',polarity:'negative',desc:'Состояние отравления'}}
  await page.route(url=>['/api/items','/api/items/search','/api/items/by-ids'].includes(url.pathname),route=>route.fulfill({json:{items:[effect]}}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test?tab=weapons')
  const header=page.locator('.character-workspace-header')
  await expect(header.getByRole('button',{name:'Добавить состояние',exact:true})).toBeVisible()
  await page.evaluate(()=>document.fonts.ready)
  await expect(page.locator('.page-forward-enter-active,.page-backward-enter-active')).toHaveCount(0)
  return {api,header}
}

for(const width of [320,390,704,1440])test(`header adds a condition after dice without overflow at ${width}`,async({page},info)=>{
  const {api,header}=await open(page,width),metrics=header.getByRole('group',{name:'Показатели персонажа',exact:true})
  const add=metrics.getByRole('button',{name:'Добавить состояние',exact:true}),picker=page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})
  expect(await metrics.locator('[data-header-metric]').evaluateAll(nodes=>nodes.map(n=>n.dataset.headerMetric))).toEqual(['armor','speed','initiative','proficiency','dice','add-status'])
  await expect(add).toHaveText('+ состояние')
  await expect(add.locator('svg')).toBeVisible()
  const geometry=await metrics.evaluate(node=>[...node.querySelectorAll('[data-header-metric]')].map(metric=>{
    const button=metric.querySelector('button'),box=button.getBoundingClientRect(),label=metric.querySelector('.header-metric-label')
    const range=document.createRange();if(label)range.selectNodeContents(label)
    return {key:metric.dataset.headerMetric,box:box.toJSON(),labels:label?[...range.getClientRects()].map(r=>r.toJSON()):[]}
  }))
  for(const {box,labels} of geometry){
    expect(box.width).toBeGreaterThanOrEqual(48)
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(width)
    for(const rect of labels){expect(rect.left).toBeGreaterThanOrEqual(box.left-.5);expect(rect.right).toBeLessThanOrEqual(box.right+.5);expect(rect.bottom).toBeLessThanOrEqual(box.bottom+.5)}
  }
  const dice=geometry[4].box,condition=geometry[5].box
  expect(new Set(geometry.map(row=>Math.round(row.box.top))).size).toBe(width===320?2:1)
  if(Math.abs(condition.top-dice.top)<1)expect(condition.left).toBeGreaterThanOrEqual(dice.right-.5)
  else expect(condition.top).toBeGreaterThanOrEqual(dice.bottom-.5)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await info.attach(`header-${width}`,{body:await header.screenshot(),contentType:'image/png'})
  await info.attach('metric-geometry',{body:Buffer.from(JSON.stringify(geometry)),contentType:'application/json'})
  const before=structuredClone(api.writes)
  await add.click()
  await expect(picker).toBeVisible()
  expect(api.writes).toEqual(before)
  if(width===704){
    await picker.getByText('Отравление',{exact:true}).click()
    await picker.getByRole('button',{name:'+ Добавить',exact:true}).click()
    await expect(picker).toHaveCount(0)
    await expect(header.getByRole('button',{name:'Отравление',exact:true})).toBeVisible()
    await expect.poll(()=>api.document().values.states.map(s=>s.effect_id)).toEqual([951])
    expect(api.document().values.states[0].source.kind).toBe('manual')
  }else{
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)
    expect(api.writes).toEqual(before)
  }
})

test('reader sees a disabled add-condition action and cannot open its picker',async({page})=>{
  const {api,header}=await open(page,704,false)
  const add=header.getByRole('button',{name:'Добавить состояние',exact:true})
  await expect(add).toBeDisabled()
  await add.evaluate(button=>button.click())
  await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toHaveCount(0)
  expect(api.writes).toHaveLength(0)
})
