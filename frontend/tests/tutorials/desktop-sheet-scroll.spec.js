import {expect,test} from '@playwright/test'
import {fixture} from './fixtures/character-layout'

async function open(page,modal=false){
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:1440,height:720})
  let api
  if(modal)await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
  else{
    api=await fixture(page)
    await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
    await page.goto('/char/test')
  }
  await expect(page.locator('.dnd-desktop-body')).toBeVisible()
  await expect(page.locator('.dnd-desktop-utilities [data-sheet-field="lvl"]')).toHaveCount(0)
  await page.evaluate(()=>document.fonts.ready)
  await page.locator('.dnd-desktop-body').evaluate(async node=>{
    const running=[]
    for(let parent=node;parent;parent=parent.parentElement)running.push(...parent.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))
    await Promise.all(running)
  })
  await page.locator('.dnd-desktop-stats').evaluate(node=>{node.style.minHeight='1200px'})
  await page.locator('.inner-tab-pane:visible').evaluate(node=>{
    const long=document.createElement('div');long.style.height='6000px';node.append(long)
  })
  const scroll=page.locator(modal?'.csm-body':'.sheet-scroll')
  return {api,scroll,left:page.locator('.dnd-desktop-stats'),right:page.locator('.dnd-desktop-utilities')}
}
async function move(scroll,top){
  await scroll.evaluate((node,value)=>{node.scrollTop=value},top)
  await scroll.page().evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
}
async function bottom(node){const r=await node.boundingBox();return r.y+r.height}

for(const modal of [false,true])test(`side columns stop independently on ${modal?'modal':'page'}`,async({page},info)=>{
  const {api,scroll,left,right}=await open(page,modal)
  const viewport=await scroll.boundingBox()
  const initialLeft=await left.boundingBox(),initialRight=await right.boundingBox()
  expect(initialRight.height).toBeLessThan(viewport.height)
  const shortTop=viewport.y
  await move(scroll,100)
  expect((await left.boundingBox()).y).toBeLessThan(initialLeft.y-90)
  expect((await right.boundingBox()).y).toBeCloseTo(shortTop,0)
  // Add an independently growing widget after the first layout measurement.
  await right.evaluate(node=>{const extra=document.createElement('div');extra.dataset.extraWidget='';extra.style.cssText='flex:none;height:2100px';node.append(extra)})
  await expect.poll(async()=>(await right.boundingBox()).height).toBeGreaterThan(initialLeft.height+100)
  const rightHeight=(await right.boundingBox()).height
  await move(scroll,initialLeft.height-viewport.height+200)
  const leftEnd=await bottom(left),rightBefore=(await right.boundingBox()).y
  await move(scroll,initialLeft.height-viewport.height+300)
  expect(await bottom(left)).toBeCloseTo(leftEnd,0)
  expect((await right.boundingBox()).y).toBeCloseTo(rightBefore-100,0)
  await move(scroll,rightHeight+300)
  const endpoints={left:await bottom(left),right:await bottom(right)}
  expect(endpoints.left).toBeLessThanOrEqual(viewport.y+viewport.height+1)
  expect(endpoints.right).toBeCloseTo(endpoints.left,0)
  await move(scroll,rightHeight+900)
  expect(await bottom(left)).toBeCloseTo(endpoints.left,0)
  expect(await bottom(right)).toBeCloseTo(endpoints.right,0)
  await move(scroll,100000)
  expect(await bottom(left)).toBeCloseTo(endpoints.left,0)
  expect(await bottom(right)).toBeCloseTo(endpoints.right,0)
  await info.attach('independent-column-ends',{body:await page.screenshot(),contentType:'image/png'})
  await move(scroll,0)
  expect((await left.boundingBox()).y).toBeCloseTo(initialLeft.y,0)
  expect((await right.boundingBox()).y).toBeCloseTo(initialRight.y,0)
  if(api)expect(api.writes).toEqual([])
})

test('pinned columns adapt to viewport changes and collapsed content',async({page})=>{
  const {scroll,left,right}=await open(page)
  await move(scroll,2000)
  await page.setViewportSize({width:1440,height:520})
  await expect.poll(async()=>{const box=await scroll.boundingBox();return await bottom(left)-box.y-box.height}).toBeCloseTo(0,0)
  await right.evaluate(node=>{const extra=document.createElement('div');extra.dataset.extraWidget='';extra.style.cssText='flex:none;height:1400px';node.append(extra)})
  await move(scroll,4000)
  await expect.poll(async()=>await bottom(right)).toBeCloseTo(await bottom(left),0)
  await right.locator('[data-extra-widget]').evaluate(node=>node.remove())
  // Make the remaining column short enough to pin at its upper edge.
  await right.evaluate(node=>{node.style.height='200px';node.style.overflow='clip'})
  await expect.poll(async()=>(await right.boundingBox()).y).toBeCloseTo((await scroll.boundingBox()).y,0)
  await move(scroll,0)
  await expect(page.getByRole('navigation',{name:'Раздел персонажа'})).toBeVisible()
})

for(const modal of [false,true])test(`phone ability order preserves selection across formats on ${modal?'modal':'page'}`,async({page})=>{
  await open(page,modal)
  const nav=page.locator('[data-sheet-navigation]')
  const labels=()=>nav.getByRole('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))
  for(const target of ['Способности','Предметы']){
    await page.setViewportSize({width:390,height:720})
    await expect.poll(labels).toEqual(['Статы','Оружие','Магия','Способности','Предметы','Личность','Дневник'])
    await nav.getByRole('button',{name:target,exact:true}).click()
    for(const width of [834,1440,390]){
      await page.setViewportSize({width,height:720})
      const label=width>=1200 && target==='Предметы'?'Снаряжение':target
      await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true')
      const section=target==='Способности'?'abilities':'inventory'
      await expect(page.locator(`[data-sheet-section="${section}"]:visible`)).toBeVisible()
      if(width===834)await expect.poll(labels).toEqual(['Статы','Оружие','Магия','Предметы','Способности','Личность','Дневник'])
    }
  }
})
