import { expect,test } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function open(page,width,{longName=false,owner=true,withCondition=true,deferredSVG=false}={}) {
  await page.setViewportSize({width,height:650})
  const state=await fixture(page,'DND5',owner)
  if(withCondition) state.document().values.states=[{uid:'poison',effect_id:951}]
  if(longName) state.document().values.name='Очень длинное имя персонажа '.repeat(5)
  await page.route(url=>url.pathname==='/api/items/by-ids',route=>route.fulfill({json:{items:[{id:951,typeId:15,name:'Отравление',svgId:deferredSVG?99:undefined,data:{code:'poisoned',desc:'Состояние отравления'}}]}}))
  if(deferredSVG) await page.route('**/api/svg/99',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M2 2h20v20H2z"/></svg>'}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test')
  await expect(page.getByRole('button',{name:'Добавить состояние',exact:true})).toBeVisible({timeout:15000})
  await page.evaluate(()=>document.fonts.ready)
  return state
}
for(const [width,longName,inline] of [[390,false,false],[700,false,false],[834,false,true],[834,true,false],[1440,true,true]]) {
  test(`conditions use available header space at ${width} (long name=${longName})`,async({page},testInfo)=>{
    await open(page,width,{longName})
    const header=page.locator('.character-workspace-header')
    await expect.poll(()=>header.evaluate(node=>{
      const tile=node.querySelector('.dnd-heading').getBoundingClientRect(),context=node.querySelector('.workspace-header-context').getBoundingClientRect()
      return {inline:node.classList.contains('workspace-header--context-inline'),right:context.left>tile.right,below:context.top>=tile.bottom-.5}
    })).toMatchObject(inline ? {inline:true,right:true} : {inline:false,below:true})
    await expect(header.locator('.dsov-icon .item-icon')).toBeVisible()
    await expect(header.locator('.dsov-icon')).toHaveCSS('width','24px')
    await expect(header.locator('.dsov-icon .item-icon')).toHaveCSS('width','24px')
    await expect.poll(()=>header.locator('.dsov-icon img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true)
    const iconBounds=await header.locator('.dsov-icon').evaluate(node=>{
      const box=node.getBoundingClientRect(),image=node.querySelector('img').getBoundingClientRect()
      return {left:image.left-box.left,right:box.right-image.right,top:image.top-box.top,bottom:box.bottom-image.bottom}
    })
    expect(Object.values(iconBounds).every(value=>value>=-.5)).toBe(true)
    const condition=header.getByRole('button',{name:'Отравление',exact:true})
    await condition.focus()
    await expect(condition).toHaveCSS('border-top-left-radius','10px')
    await condition.click()
    await expect(condition).toHaveClass(/action-menu-source--open/)
    await expect(condition).toHaveCSS('border-top-right-radius','10px')
    await testInfo.attach(`condition-highlight-${width}-${longName}`,{body:await header.screenshot(),contentType:'image/png'})
    await page.keyboard.press('Escape')
    const character=header.getByRole('button',{name:'Действия персонажа',exact:true})
    await character.focus()
    await expect(character).toHaveCSS('border-top-left-radius','12px')
    await character.click()
    await expect(character).toHaveClass(/action-menu-source--open/)
    await expect(character).toHaveCSS('border-bottom-right-radius','12px')
    await page.keyboard.press('Escape')
    const add=header.getByRole('button',{name:'Добавить состояние',exact:true})
    await expect(add).toHaveCSS('border-top-style','dashed')
    await add.click();await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await testInfo.attach(`context-${width}-${longName}`,{body:await header.screenshot(),contentType:'image/png'})
  })
}
test('the condition row and add button remain present on an empty phone sheet',async({page})=>{
  await open(page,390,{withCondition:false})
  await expect(page.locator('.workspace-header-context').getByRole('button',{name:'Добавить состояние',exact:true})).toBeVisible()
})
test('read-only characters expose icons but cannot add conditions',async({page})=>{
  await open(page,834,{owner:false})
  await expect(page.getByRole('button',{name:'Добавить состояние',exact:true})).toBeDisabled()
  await expect(page.locator('.dsov-icon .item-icon')).toBeVisible()
})

test('condition icons referenced by SVG ID load into the header',async({page})=>{
  await open(page,834,{deferredSVG:true})
  await expect(page.locator('.dsov-icon .svg-icon--asset')).toHaveCSS('mask-image',/blob:/)
})
