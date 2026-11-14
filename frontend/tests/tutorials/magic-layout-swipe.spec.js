import {expect,test} from '@playwright/test'
import {fixture} from './fixtures/character-layout.js'

for(const width of [390,834,1920])for(const both of [false,true])test(`compact spell slots and visible book settings at ${width} (both pools=${both})`,async({page},info)=>{
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/tests/tutorials/fixtures/spell-rolls.html?books=multiple'+(both?'':'&slots=base-only'),{waitUntil:'domcontentloaded'})
  const slots=page.locator('.sp-slots-panel')
  await expect(slots).toBeVisible()
  await expect(slots.locator('.sp-pool-head')).toHaveCount(both?2:0)
  await expect(slots.getByText(/восстанавливаются/)).toHaveCount(0)
  await expect(page.getByText('Параметры книги магии',{exact:true})).toHaveCount(0)
  await expect(page.locator('.sp-stats-panel')).toBeVisible()
  await expect(page.locator('.sp-stats-panel')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
  expect(await page.locator('.spell-parameter-label').allTextContents()).toEqual(['Базовая хар-ка','Атака заклинанием','СЛ спасброска'])
  const settings=page.getByRole('button',{name:'Настройки вкладки',exact:true})
  await expect(settings).toBeVisible()
  const columns=await page.locator('.spell-parameters-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(width===390?2:4)
  await settings.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape')
  const book=page.getByRole('tab',{name:'Волшебник',exact:true})
  await expect(book).toHaveAttribute('aria-selected','true')
  await expect(book.locator('.spellbook-paper--active')).toHaveCount(1)
  const geometry=await slots.locator('.sp-slot-row').first().evaluate(row=>{
    const buttons=[...row.querySelectorAll('.sp-orb-hit')].map(n=>n.getBoundingClientRect())
    const orb=row.querySelector('.ss').getBoundingClientRect()
    return {height:row.getBoundingClientRect().height,hit:buttons[0].width,pitch:buttons[1].left-buttons[0].left,orb:orb.width}
  })
  expect(geometry.hit).toBe(width<1200?44:36)
  expect(geometry.orb).toBe(width<1200?36:30)
  expect(geometry.pitch).toBe(geometry.hit)
  expect(geometry.height).toBeLessThanOrEqual(width<1200?49:41)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(await page.evaluate(()=>window.writes)).toEqual([])
  await expect(page.getByRole('tab',{name:'Чародей',exact:true})).toHaveAttribute('aria-selected','false')
  await info.attach(`magic-density-${width}-${both}`,{body:await page.screenshot(),contentType:'image/png'})
})

test.describe('magic touch interactions',()=>{
 test.use({hasTouch:true})
 async function open(page,width){
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width,height:760})
  await page.emulateMedia({reducedMotion:'reduce'})
  const api=await fixture(page)
  api.document().values.spells={schema_version:2,slot_pools:{long_rest:[{level:1,total:4,used:0},{level:2,total:2,used:0}],short_rest:[]},tabs:[
   {key:'wizard',name:'Волшебник',casting_ability:4,mode:'spellbook',spells:[{key:'first',id:551},{key:'second',id:552}]},
   {key:'sorcerer',name:'Чародей',casting_ability:6,mode:'known',spells:[]},
  ],grants:[]}
  await page.route('**/api/items/by-ids?**',r=>r.fulfill({json:{items:[551,552].map(id=>({id,typeId:5,name:id===551?'Первое заклинание':'Второе заклинание',data:{lvl:1,time:{kind:'action'},range:{kind:'ranged',distance:60},duration:'1 минута',components:{v:true,s:true},damage:{range_attack:true,dices:[{dice_id:'d6',count:2}]}}}))}}))
  await page.route('**/api/handbook/sync?**',r=>r.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test',{waitUntil:'domcontentloaded'})
  await magic(page)
  return {api,errors}
 }
 async function magic(page){
  await page.locator('[data-sheet-navigation]').getByRole('button',{name:'Магия',exact:true}).click()
  await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
  await expect(page.locator('.mobile-swipe-pane:not([inert]) .sp-slots-panel')).toBeVisible()
 }
 async function touch(page,target,dx,dy=0,hold=0){
  await target.scrollIntoViewIfNeeded()
  const b=await target.boundingBox(),start={x:b.x+b.width/2,y:b.y+b.height/2}
  const client=await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
  if(hold){await page.waitForTimeout(hold);await expect(page.locator('body')).toHaveClass(/sortable-dragging/)}
  for(const p of [.2,.55,1]){
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*p,y:start.y+dy*p}]})
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  }
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await client.detach()
 }
 for(const width of [390,834])test(`swiping from a slot and a clickable spell does not activate them at ${width}`,async({page})=>{
  const {api,errors}=await open(page,width)
  for(const selector of ['.sp-orb-hit','.spell-row .sp-name','.spell-parameter-settings']){
   await magic(page)
   const target=page.locator('.mobile-swipe-pane:not([inert])').locator(selector).first()
   await touch(page,target,-Math.min(180,width*.4))
   await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Предметы')
   await expect(page.getByRole('menu')).toHaveCount(0)
   await expect(page.getByRole('dialog')).toHaveCount(0)
   expect(api.document().values.spells.slot_pools.long_rest[0].used).toBe(0)
   expect(api.writes).toEqual([])
  }
  expect(errors).toEqual([])
 })
 for(const width of [390,834])test(`taps and vertical scrolling on magic controls remain independent at ${width}`,async({page})=>{
  const {api,errors}=await open(page,width)
  const pane=page.locator('.mobile-swipe-pane:not([inert])'),slot=pane.getByRole('button',{name:'Ячейка 1 круга · 1',exact:true})
  await touch(page,slot,2,-85)
  await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
  expect(api.writes).toEqual([])
  await slot.scrollIntoViewIfNeeded();const b=await slot.boundingBox()
  await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2)
  await expect.poll(()=>api.document().values.spells.slot_pools.long_rest[0].used).toBe(1)
  const name=pane.locator('.spell-row .sp-name').first();await name.scrollIntoViewIfNeeded();const n=await name.boundingBox()
  await page.touchscreen.tap(n.x+n.width/2,n.y+n.height/2)
  await expect(page.getByRole('menu')).toBeVisible()
  expect(errors).toEqual([])
 })
 test('book tabs keep keyboard navigation and do not turn a local scroll into a page swipe',async({page})=>{
  const {api,errors}=await open(page,390)
  const tabs=page.getByRole('tablist',{name:'Источники магии'})
  await tabs.getByRole('tab',{name:'Волшебник',exact:true}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab',{name:'Чародей',exact:true})).toHaveAttribute('aria-selected','true')
  await expect(page.getByRole('tabpanel',{name:'Чародей',exact:true})).toBeVisible()
  await touch(page,tabs,-65)
  await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
  expect(api.writes).toEqual([]);expect(errors).toEqual([])
 })
 test('holding a spell still reorders it without changing the sheet tab',async({page})=>{
  const {api,errors}=await open(page,390)
  await page.setViewportSize({width:390,height:1100})
  const pane=page.locator('.mobile-swipe-pane:not([inert])'),first=pane.locator('.spell-row .sp-name').first(),second=pane.locator('.spell-row').nth(1)
  await second.scrollIntoViewIfNeeded()
  await first.scrollIntoViewIfNeeded();const a=await first.boundingBox(),b=await second.boundingBox()
  expect(b.y+b.height*.75).toBeLessThan(1100)
  await touch(page,first,0,b.y+b.height*.75-(a.y+a.height/2),450)
  await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
  await expect.poll(()=>api.document().values.spells.tabs[0].spells.map(s=>s.id)).toEqual([552,551])
  await expect(page.getByRole('menu')).toHaveCount(0);expect(errors).toEqual([])
 })
})
