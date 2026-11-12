import { expect,test } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function open(page,width,longName=false,owner=true) {
  await page.setViewportSize({width,height:650})
  const state=await fixture(page,'DND5',owner)
  state.document().values.states=[{uid:'poison',effect_id:951}]
  if(longName) state.document().values.name='Очень длинное имя персонажа '.repeat(5)
  await page.route(url=>url.pathname==='/api/items/by-ids',route=>route.fulfill({json:{items:[{id:951,typeId:15,name:'Отравление',data:{code:'poisoned',desc:'Состояние отравления'}}]}}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test')
  await expect(page.getByRole('button',{name:'Добавить состояние',exact:true})).toBeVisible({timeout:15000})
  await page.evaluate(()=>document.fonts.ready)
  return state
}
for(const [width,longName,inline] of [[390,false,false],[700,false,false],[834,false,true],[834,true,false],[1440,true,true]]) {
  test(`conditions use available header space at ${width} (long name=${longName})`,async({page},testInfo)=>{
    await open(page,width,longName)
    const header=page.locator('.character-workspace-header')
    await expect.poll(()=>header.evaluate(node=>node.classList.contains('workspace-header--context-inline'))).toBe(inline)
    const placement=await header.evaluate(node=>{
      const tile=node.querySelector('.dnd-heading').getBoundingClientRect(),context=node.querySelector('.workspace-header-context').getBoundingClientRect()
      return {tileRight:tile.right,tileBottom:tile.bottom,contextLeft:context.left,contextTop:context.top}
    })
    if(inline) expect(placement.contextLeft).toBeGreaterThan(placement.tileRight)
    else expect(placement.contextTop).toBeGreaterThanOrEqual(placement.tileBottom-.5)
    await expect(header.locator('.dsov-icon .item-icon')).toBeVisible()
    await expect(header.getByRole('button',{name:'Отравление',exact:true})).toBeVisible()
    const add=header.getByRole('button',{name:'Добавить состояние',exact:true})
    await expect(add).toHaveCSS('border-top-style','dashed')
    await add.click();await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await testInfo.attach(`context-${width}-${longName}`,{body:await header.screenshot(),contentType:'image/png'})
  })
}
test('the condition row and add button remain present on an empty phone sheet',async({page})=>{
  await page.setViewportSize({width:390,height:650});await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.locator('.workspace-header-context').getByRole('button',{name:'Добавить состояние',exact:true})).toBeVisible()
})
test('read-only characters expose icons but cannot add conditions',async({page})=>{
  await open(page,834,false,false)
  await expect(page.getByRole('button',{name:'Добавить состояние',exact:true})).toBeDisabled()
  await expect(page.locator('.dsov-icon .item-icon')).toBeVisible()
})
