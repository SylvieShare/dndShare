import { expect,test } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function open(page,width,{longName=false,owner=true,withCondition=true,deferredSVG=false,duration={kind:'manual'}}={}) {
  await page.setViewportSize({width,height:650})
  const state=await fixture(page,'DND5',owner)
  if(withCondition) state.document().values.states=[{uid:'poison',effect_id:951,duration}]
  if(longName) state.document().values.name='Очень длинное имя персонажа '.repeat(5)
  await page.route(url=>url.pathname==='/api/items/by-ids',route=>route.fulfill({json:{items:[{id:951,typeId:15,name:'Отравление',svgId:deferredSVG?99:undefined,data:{code:'poisoned',desc:'Состояние отравления'}}]}}))
  if(deferredSVG) await page.route('**/api/svg/99',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M2 2h20v20H2z"/></svg>'}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test')
  await expect(page.getByRole('button',{name:'Действия персонажа',exact:true})).toBeVisible({timeout:15000})
  if(withCondition) await expect(page.locator('.dsov-effect')).toHaveCount(1)
  await page.evaluate(()=>document.fonts.ready)
  return state
}
for(const [width,longName,inline] of [[390,false,false],[700,false,true],[834,false,true],[834,true,false],[1440,true,true]]) {
  test(`conditions use available header space at ${width} (long name=${longName})`,async({page},testInfo)=>{
    await open(page,width,{longName,duration:{kind:'minutes',value:10}})
    const header=page.locator('.character-workspace-header')
    await expect.poll(()=>header.evaluate(node=>{
      const tile=node.querySelector('.dnd-heading').getBoundingClientRect(),context=node.querySelector('.workspace-header-context').getBoundingClientRect()
      return {inline:node.classList.contains('workspace-header--context-inline'),right:context.left>tile.right,below:context.top>=tile.bottom-.5}
    })).toMatchObject(inline ? {inline:true,right:true} : {inline:false,below:true})
    if(inline) {
      const gap=await header.evaluate(node=>node.querySelector('.dsov-effect').getBoundingClientRect().left-node.querySelector('.dnd-heading').getBoundingClientRect().right)
      expect(gap).toBeGreaterThanOrEqual(23.5)
    }
    await expect(header.locator('.dsov-icon .item-icon')).toBeVisible()
    await expect(header.locator('.portrait')).toHaveCSS('width','56px')
    await expect(header.locator('.dsov-icon')).toHaveCSS('width','56px')
    await expect(header.locator('.dsov-icon .item-icon')).toHaveCSS('width','56px')
    await expect(header.locator('.dsov-duration')).toHaveText('10 минут')
    await expect(header.locator('.dsov-duration')).toHaveCSS('font-size','11px')
    await expect(header.locator('.dsov-duration svg')).toBeVisible()
    const caption=await header.locator('.dsov-copy').evaluate(node=>({nameBottom:node.querySelector('.dsov-name').getBoundingClientRect().bottom,durationTop:node.querySelector('.dsov-duration').getBoundingClientRect().top}))
    expect(caption.durationTop).toBeGreaterThan(caption.nameBottom)
    await expect.poll(()=>header.locator('.dsov-icon img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true)
    const iconBounds=await header.locator('.dsov-icon').evaluate(node=>{
      const box=node.getBoundingClientRect(),image=node.querySelector('img').getBoundingClientRect()
      return {left:image.left-box.left,right:box.right-image.right,top:image.top-box.top,bottom:box.bottom-image.bottom}
    })
    expect(Object.values(iconBounds).every(value=>value>=-.5)).toBe(true)
    const condition=header.getByRole('button',{name:'Отравление',exact:true})
    await condition.focus()
    await expect(condition).toHaveCSS('border-top-left-radius','12px')
    await condition.click()
    await expect(condition).toHaveClass(/action-menu-source--open/)
    await expect(condition).toHaveCSS('border-top-right-radius','12px')
    await testInfo.attach(`condition-highlight-${width}-${longName}`,{body:await header.screenshot(),contentType:'image/png'})
    await page.keyboard.press('Escape')
    const character=header.getByRole('button',{name:'Действия персонажа',exact:true})
    const characterTile=header.locator('.dnd-heading')
    await character.focus()
    await expect(characterTile).toHaveCSS('border-top-left-radius','12px')
    await character.click()
    await expect(characterTile).toHaveClass(/action-menu-source--open/)
    await expect(characterTile).toHaveCSS('border-bottom-right-radius','12px')
    await expect(header.getByRole('button',{name:'Добавить состояние',exact:true})).toHaveCount(0)
    const add=page.getByRole('menuitem',{name:'Добавить состояние',exact:true})
    await add.click();await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('[role="menu"]')).toHaveCount(0)
    await testInfo.attach(`context-${width}-${longName}`,{body:await header.screenshot(),contentType:'image/png'})
  })
}
test('an empty phone sheet adds conditions through the character tile without an empty row',async({page})=>{
  await open(page,390,{withCondition:false})
  await expect(page.locator('.workspace-header-context')).toHaveCount(0)
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  await page.getByRole('menuitem',{name:'Добавить состояние',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toBeVisible()
})
test('read-only characters expose icons but cannot add conditions',async({page})=>{
  await open(page,834,{owner:false})
  await expect(page.getByRole('button',{name:'Добавить состояние',exact:true})).toHaveCount(0)
  await expect(page.locator('.dsov-icon .item-icon')).toBeVisible()
  await expect(page.locator('.dsov-duration')).toHaveText('До ручного снятия')
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  await expect(page.getByRole('menuitem',{name:'Добавить состояние',exact:true})).toBeDisabled()
})

test('condition icons referenced by SVG ID load into the header',async({page})=>{
  await open(page,834,{deferredSVG:true})
  await expect(page.locator('.dsov-icon .svg-icon--asset')).toHaveCSS('mask-image',/blob:/)
})

test('long condition durations wrap within a phone header',async({page})=>{
  const text='До окончания следующего продолжительного отдыха и выполнения условия. '.repeat(3).slice(0,200)
  await open(page,390,{duration:{kind:'custom',text}})
  await expect(page.locator('.dsov-duration')).toHaveText(text)
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const bounds=await page.locator('.dsov-effect').evaluate(node=>({card:node.getBoundingClientRect().toJSON(),label:node.querySelector('.dsov-duration').getBoundingClientRect().toJSON()}))
  expect(bounds.label.right).toBeLessThanOrEqual(bounds.card.right+.5)
  expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.card.bottom+.5)
})

test('the inline gap participates in fitting and remains stable near the wrap boundary',async({page})=>{
  await open(page,1000,{longName:true})
  const header=page.locator('.character-workspace-header')
  await expect(header).toHaveClass(/workspace-header--context-inline/)
  const minimum=await header.evaluate(node=>{
    const main=node.querySelector('.workspace-header-inner'),style=getComputedStyle(main)
    return parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+2*parseFloat(style.columnGap)
      +node.querySelector('.workspace-header-identity').offsetWidth+node.querySelector('.workspace-header-actions').offsetWidth
      +node.querySelector('.dsov-effect').offsetWidth
  })
  const narrow=Math.ceil(minimum+8)
  expect(narrow).toBeGreaterThanOrEqual(768)
  await page.setViewportSize({width:narrow,height:650})
  await expect(header).not.toHaveClass(/workspace-header--context-inline/)
  const placements=await header.evaluate(node=>new Promise(resolve=>{
    const frames=[]
    function frame(){frames.push(node.classList.contains('workspace-header--context-inline'));if(frames.length===8)resolve(frames);else requestAnimationFrame(frame)}
    requestAnimationFrame(frame)
  }))
  expect(placements.every(value=>!value)).toBe(true)
  await page.setViewportSize({width:narrow+32,height:650})
  await expect(header).toHaveClass(/workspace-header--context-inline/)
  await expect(page.locator('.dsov-effect')).toHaveCount(1)
})
