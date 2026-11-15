import { test,expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'

function combatant(uid,name,position,initiative,index) {
  return {uid,type:'npc',itemId:null,override:{name,hp:12,ac:13},position,initiative,
    hpCurrent:12,hpTemp:0,hpDsSuccess:0,hpDsFailure:0,surprised:false,tieBreak:0,
    markerLetter:String.fromCharCode(65+index)}
}

async function openEncounter(page,reserveCount=2) {
  page.on('pageerror',error=>{throw error})
  const encounter={active:true,round:1,turnIndex:0,combatants:[
    combatant('current','Страж','combat',18,0),
    ...Array.from({length:reserveCount},(_,i)=>combatant(`reserve-${i+1}`,`Запас ${i+1}`,'reserve',i===1?22:10,i+1)),
  ]}
  const api=await sessionLayout(page,{url:'/sessions/test',participants:[],encounter})
  await page.getByRole('button',{name:/Открыть бой/}).click()
  const root=page.locator('.enc-wrap--workspace')
  await expect(root).toBeVisible()
  await expect(page.locator('.page-forward-enter-active,.page-backward-enter-active')).toHaveCount(0)
  const row=uid=>root.locator(`.enc-row-shell[data-encounter-uid="${uid}"]`)
  await expect(row('reserve-1')).toContainText('Запас 1')
  return {api,root,row,reserveOrder:()=>api.encounter().combatants.filter(c=>c.position==='reserve').map(c=>c.uid)}
}

async function point(locator) {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toBeInViewport({ratio:1})
  const box=await locator.boundingBox()
  expect(box).not.toBeNull()
  return {x:box.x+Math.min(box.width/2,30),y:box.y+box.height/2}
}

test('mouse hold reorders and transfers creatures while click and Escape keep their actions',async({page},info)=>{
  await page.setViewportSize({width:1440,height:932})
  const {api,root,row,reserveOrder}=await openEncounter(page)
  const ghost=page.locator('.sortable-ghost'),menu=page.getByRole('menu',{name:'Действия существа',exact:true})
  await row('reserve-1').locator('.p-name-text').click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  let start=await point(row('reserve-2').locator('.p-name-text'))
  await page.mouse.move(start.x,start.y)
  await page.mouse.down()
  await page.mouse.move(start.x+20,start.y)
  await expect(ghost).toHaveCount(0)
  await page.mouse.up()
  expect(reserveOrder()).toEqual(['reserve-1','reserve-2'])

  await page.mouse.move(start.x,start.y)
  await page.mouse.down()
  await expect(ghost).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(ghost).toHaveCount(0)
  await page.mouse.up()
  expect(reserveOrder()).toEqual(['reserve-1','reserve-2'])
  await expect(menu).toHaveCount(0)

  await page.mouse.down()
  await expect(ghost).toBeVisible()
  const first=await row('reserve-1').boundingBox()
  await page.mouse.move(start.x,first.y+2,{steps:5})
  await page.mouse.up()
  await expect.poll(reserveOrder).toEqual(['reserve-2','reserve-1'])
  await expect(menu).toHaveCount(0)
  expect(api.writes.length).toBeGreaterThan(0)

  start=await point(row('reserve-2').locator('.p-name-text'))
  const current=await row('current').boundingBox()
  await page.mouse.move(start.x,start.y)
  await page.mouse.down()
  await expect(ghost).toBeVisible()
  await page.mouse.move(start.x,current.y+2,{steps:5})
  await page.mouse.up()
  await expect.poll(()=>api.encounter().combatants.find(c=>c.uid==='reserve-2').position).toBe('combat')
  await expect(root.locator('.enc-row-shell[data-encounter-section="combat"]')).toHaveCount(2)
  await expect(menu).toHaveCount(0)
  await info.attach('held-mouse-result',{body:await root.screenshot(),contentType:'image/png'})
})

test.describe('touch encounter gestures',()=>{
  test.use({hasTouch:true})

  test('stationary touch hold allows reserve reorder without opening the row menu',async({page},info)=>{
    await page.setViewportSize({width:932,height:704})
    const {api,root,row,reserveOrder}=await openEncounter(page)
    const touch=await page.context().newCDPSession(page)
    const start=await point(row('reserve-2').locator('.p-name-text')),first=await row('reserve-1').boundingBox()
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
    await expect(page.locator('.sortable-ghost')).toBeVisible()
    for(let step=1;step<=5;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y:start.y+(first.y+2-start.y)*step/5}]})
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await expect.poll(reserveOrder).toEqual(['reserve-2','reserve-1'])
    await expect(page.getByRole('menu',{name:'Действия существа',exact:true})).toHaveCount(0)
    expect(api.writes.length).toBeGreaterThan(0)
    await info.attach('held-touch-result',{body:await root.screenshot(),contentType:'image/png'})
    await touch.detach()
  })

  test('vertical touch movement before hold scrolls the list and preserves creature order',async({page})=>{
    await page.setViewportSize({width:932,height:704})
    const {api,root,row,reserveOrder}=await openEncounter(page,12)
    const original=reserveOrder(),primary=root.locator('.enc-combat-primary'),touch=await page.context().newCDPSession(page)
    const start=await point(row('reserve-1').locator('.p-name-text'))
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
    for(let step=1;step<=5;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y:start.y-step*24}]})
    await expect(page.locator('.sortable-ghost')).toHaveCount(0)
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await expect.poll(()=>primary.evaluate(node=>node.scrollTop)).toBeGreaterThan(30)
    expect(reserveOrder()).toEqual(original)
    expect(api.writes).toHaveLength(0)
    await expect(page.getByRole('menu',{name:'Действия существа',exact:true})).toHaveCount(0)
    await touch.detach()
  })
})
