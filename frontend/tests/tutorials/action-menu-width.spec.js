import { test,expect } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'
import { fixture } from './fixtures/character-layout.js'

async function expectFitted(menu,count,width,info,name) {
  await expect(menu).toHaveAttribute('data-share-menu-content-sized','')
  await expect(menu.locator('.character-menu-action')).toHaveCount(count)
  await expect.poll(()=>menu.evaluate(node=>{
    const group=node.querySelector('.character-menu-actions'),header=node.querySelector('.character-menu-header')
    const style=getComputedStyle(node),headerStyle=getComputedStyle(header)
    const insets=['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((sum,key)=>sum+parseFloat(style[key]),0)
      +parseFloat(headerStyle.paddingLeft)+parseFloat(headerStyle.paddingRight)
    return Math.abs(node.offsetWidth-group.offsetWidth-insets)
  })).toBeLessThan(1)
  const box=await menu.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(7.5)
  expect(box.x+box.width).toBeLessThanOrEqual(width-7.5)
  expect(await menu.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1)
  await info.attach(name,{body:await menu.screenshot(),contentType:'image/png'})
}

for(const width of [475,704,1440])test(`session status menu fits three buttons at ${width}`,async({page},info)=>{
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width,height:932})
  await sessionLayout(page,{url:'/sessions/test'})
  const sidebar=page.locator('aside.map-sidebar')
  if((await sidebar.getAttribute('class')).includes('map-sidebar--collapsed'))await page.getByRole('navigation',{name:'Боковые вкладки сессии'}).getByRole('button',{name:'Игроки',exact:true}).click()
  const status=sidebar.getByRole('button',{name:'Благословение',exact:true})
  await expect(status).toBeVisible()
  await page.evaluate(()=>document.fonts.ready)
  await status.click()
  const menu=page.getByRole('menu',{name:'Действия: Благословение',exact:true})
  await expectFitted(menu,3,width,info,`three-actions-${width}`)
  await menu.getByRole('button',{name:'Изменить длительность',exact:true}).click()
  const editor=page.getByRole('dialog',{name:'Длительность: Благословение',exact:true})
  await expect(editor).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
})

async function character(page,owner) {
  page.on('pageerror',error=>{throw error})
  await page.setViewportSize({width:475,height:932})
  const api=await fixture(page,'DND5',owner)
  api.document().values.states=[{uid:'bless',effect_id:701}]
  api.document().values.inspiration=true
  api.document().values.exhaustion={level:1}
  const items=[{id:701,name:'Благословение',data:{code:'bless'}},{id:703,name:'Вдохновение',data:{code:'inspiration'}},{id:704,name:'Истощение',data:{code:'exhaustion'}}]
    .map(item=>({...item,typeId:15,compatibility:[{sourceVersionId:1,status:'native'}]}))
  await page.route(url=>['/api/items','/api/items/by-ids'].includes(url.pathname),route=>route.fulfill({json:{items}}))
  await page.route('**/api/handbook/sync?**',route=>route.fulfill({json:{protocol:1,entries:[],hasMore:false,cursor:'empty',visibleIds:[],metadata:{types:[],suggests:{},suggestTypes:[],books:[]}}}))
  await page.goto('/char/test')
  await expect(page.locator('.character-workspace-header')).toBeVisible()
  await page.evaluate(()=>document.fonts.ready)
  return api
}

test('two-button menus fit while additional rows and summaries keep normal layout',async({page},info)=>{
  const api=await character(page,true),header=page.locator('.character-workspace-header')
  await header.getByRole('button',{name:'Вдохновение',exact:true}).click()
  await expectFitted(page.getByRole('menu',{name:'Действия: Вдохновение',exact:true}),2,475,info,'two-actions')
  await page.keyboard.press('Escape')
  await header.getByRole('button',{name:'Истощение',exact:true}).click()
  const mixed=page.getByRole('menu',{name:'Действия: Истощение',exact:true})
  await expect(mixed.getByText('Повысить уровень',{exact:true})).toBeVisible()
  await expect(mixed).not.toHaveAttribute('data-share-menu-content-sized','')
  await expect(mixed).toHaveCSS('min-width','200px')
  await expect.poll(()=>mixed.evaluate(node=>{
    const style=getComputedStyle(node),header=node.querySelector('.character-menu-header')
    return Math.abs(header.offsetWidth-node.clientWidth+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight))
  })).toBeLessThan(1)
  await info.attach('mixed-menu',{body:await mixed.screenshot(),contentType:'image/png'})
  await page.keyboard.press('Escape')
  await header.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  const summary=page.getByRole('menu',{name:'Действия персонажа',exact:true})
  await expect(summary.locator('.character-menu-summary')).toBeVisible()
  await expect(summary).not.toHaveAttribute('data-share-menu-content-sized','')
  await expect(summary).toHaveCSS('min-width','340px')
  await page.keyboard.press('Escape')
  expect(api.writes).toHaveLength(0)
})

test('read-only single-action menus fit and keep editing unavailable',async({page},info)=>{
  const api=await character(page,false)
  await page.locator('.character-workspace-header').getByRole('button',{name:'Благословение',exact:true}).click()
  const menu=page.getByRole('menu',{name:'Действия: Благословение',exact:true})
  await expectFitted(menu,1,475,info,'one-action')
  await expect(menu.getByRole('button',{name:'Изменить длительность',exact:true})).toHaveCount(0)
  await expect(menu.getByRole('button',{name:'Убрать',exact:true})).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  expect(api.writes).toHaveLength(0)
})

test.describe('inventory menu motion', () => {
  test.use({ hasTouch: true, reducedMotion: 'no-preference' })

  test('inventory item menu enters with scale and opacity and reopens on tap', async ({ page }, info) => {
    await page.setViewportSize({ width: 475, height: 751 })
    const api = await fixture(page)
    api.document().values.items.sections = [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'pouch', item_id: 42, count: 1 }] }]
    await page.route('**/api/items/by-ids?**', route => route.fulfill({
      json: { items: [{ id: 42, name: 'Кошель', typeId: 2, iconImageUrl: '/static/tab-magic.svg', data: {} }] },
    }))
    await page.route('**/api/handbook/sync?**', route => route.fulfill({
      json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } },
    }))
    await page.goto('/char/test?tab=inventory')
    const tile = page.locator('.inventory-bag-item:visible').filter({ hasText: 'Кошель' })
    await expect(tile).toHaveCount(1)
    await tile.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      window.inventoryEntrance = {}
      document.addEventListener('transitionrun', event => {
        if (!event.target.matches('.ram-popover.share-popover-action-enter-active')) return
        const animation = event.target.getAnimations().find(animation => animation.transitionProperty === event.propertyName)
        const start = animation?.effect.getKeyframes()[0]?.[event.propertyName]
        if (event.propertyName === 'opacity') window.inventoryEntrance.opacity = Number(start)
        if (event.propertyName === 'transform' && start) window.inventoryEntrance.scale = Number(new DOMMatrix(start).a.toFixed(2))
      })
    })
    const menu = page.getByRole('menu', { name: 'Действия: Кошель', exact: true })
    await tile.tap()
    await expect(menu).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.inventoryEntrance)).toEqual({ opacity: 0, scale: .88 })
    await expect(menu).toHaveCSS('opacity', '1')
    await expect(menu).toHaveCSS('transform', 'none')
    await page.screenshot({ path: info.outputPath('inventory-menu-475.png') })

    await tile.tap()
    await expect(menu).toHaveCount(0)
    await tile.tap()
    await expect(menu.getByRole('button', { name: 'Открыть описание' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    expect(api.writes).toEqual([])
  })
})
