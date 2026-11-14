import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function openSheet(page, width, withCondition=false) {
  await page.setViewportSize({ width, height: 600 })
  const api = await fixture(page)
  if(withCondition){
    api.document().values.states=[{uid:'poison',effect_id:951,duration:{kind:'minutes',value:10}}]
    await page.route(url=>url.pathname==='/api/items/by-ids',route=>route.fulfill({json:{items:[{id:951,typeId:15,name:'Отравление',data:{code:'poisoned',desc:'Состояние отравления'}}]}}))
  }
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [],
    metadata: { types: [], suggests: {}, suggestTypes: [], books: [] },
  } }))
  await page.goto('/char/test')
  await expect(page.locator('[data-sheet-navigation]')).toBeVisible({timeout:15000})
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.view')).toHaveCSS('transform', 'none')
  return api
}

async function expectContinuousHeader(page) {
  if (await page.locator('.dnd-desktop-navigation').count()) {
    const header = page.locator('.character-workspace-header')
    await expect(header.locator('.workspace-subheader')).toHaveCount(0)
    const navigation = page.locator('.dnd-desktop-navigation [data-sheet-navigation]')
    await expect(navigation).toBeVisible()
    const geometry = await navigation.evaluate(node => {
      const nav = node.getBoundingClientRect(), main = node.closest('.dnd-desktop-main').getBoundingClientRect()
      const bar=node.closest('.workspace-subheader'),surface=node.closest('.workspace-subheader-inner'),rect=bar.getBoundingClientRect()
      return { start: nav.left - main.left, end: main.right - nav.right, overflow: getComputedStyle(node).overflowX,
        barStart:rect.left-main.left,barEnd:main.right-rect.right,background:getComputedStyle(bar).backgroundColor,
        shadow:getComputedStyle(surface).boxShadow,radius:getComputedStyle(surface).borderTopLeftRadius,bottomRadius:getComputedStyle(bar).borderBottomLeftRadius }
    })
    expect(geometry.start).toBeGreaterThanOrEqual(-1)
    expect(geometry.end).toBeGreaterThanOrEqual(-1)
    expect(geometry.overflow).toBe('auto')
    expect(geometry.background).toBe('rgb(48, 42, 61)')
    expect(geometry.shadow).toBe('none')
    expect(geometry.radius).toBe('0px')
    expect(geometry.bottomRadius).toBe('16px')
    expect(Math.abs(geometry.barStart)).toBeLessThan(1)
    expect(Math.abs(geometry.barEnd)).toBeLessThan(1)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
    return
  }
  const geometry = await page.locator('.character-workspace-header').evaluate(header => {
    const main=header.querySelector('.workspace-header-inner'),band=header.querySelector('.workspace-subheader'),surface=band.querySelector('.workspace-subheader-inner')
    const a=main.getBoundingClientRect(),b=band.getBoundingClientRect(),c=header.getBoundingClientRect()
    return {gap:b.top-a.bottom,bottom:c.bottom-b.bottom,left:b.left-c.left,right:c.right-b.right,
      background:getComputedStyle(header).backgroundColor,bandBackground:getComputedStyle(band).backgroundColor,
      surfaceBackground:getComputedStyle(surface).backgroundColor,
      shadow:getComputedStyle(surface).boxShadow,radius:getComputedStyle(surface).borderTopLeftRadius }
  })
  expect(Math.abs(geometry.gap)).toBeLessThan(.5)
  expect(Math.abs(geometry.bottom)).toBeLessThan(.5)
  expect(Math.abs(geometry.left)).toBeLessThan(.5)
  expect(Math.abs(geometry.right)).toBeLessThan(.5)
  expect(geometry.background).toBe('rgb(48, 42, 61)')
  expect(geometry.bandBackground).toBe(geometry.background)
  expect(geometry.shadow).toBe('none')
  expect(geometry.surfaceBackground).toBe('rgba(0, 0, 0, 0)')
  expect(geometry.radius).toBe('0px')
  await expect(page.locator('.mobile-sheet-navigation')).toHaveCount(0)
}

for (const [width, format, layout] of [[390, 'phone', 'compact'], [834, 'tablet', 'stacked'], [1440, 'desktop', 'stacked']]) {
  test(`local ${format} navigation stays aligned and accessible`, async ({ page }, testInfo) => {
    const api = await openSheet(page, width)
    const navigation = page.locator('[data-sheet-navigation]')
    const initialNavigationY = (await navigation.boundingBox()).y
    await expect(navigation).toHaveAttribute('data-sheet-navigation', format === 'desktop' ? 'tablet' : format)
    await expect(navigation).toHaveClass(new RegExp(`share-icon-navigation--${layout}`))
    await expect(page.locator('[data-tutorial="character-tabs"]')).toHaveCount(1)
    const first = navigation.getByRole('button').first()
    const geometry = await first.evaluate(button => {
      const icon = button.querySelector('.share-icon-navigation__icon').getBoundingClientRect()
      const label = button.querySelector('.share-icon-navigation__label').getBoundingClientRect()
      return { iconWidth: icon.width, iconRight: icon.right, iconBottom: icon.bottom, labelLeft: label.left, labelTop: label.top }
    })
    expect(geometry.iconWidth).toBeCloseTo(22, 0)
    expect(geometry.labelTop).toBeGreaterThanOrEqual(geometry.iconBottom - 1)
    await expectContinuousHeader(page)
    await testInfo.attach(`header-${format}-initial`, { body: await page.screenshot(), contentType: 'image/png' })
    if (format === 'desktop') {
      const main = await page.locator('.dnd-desktop-main').boundingBox()
      const stats = await page.locator('.dnd-desktop-stats').boundingBox()
      expect(stats.y).toBeLessThanOrEqual(main.y + 1)
    }
    const scroller = page.locator(format === 'desktop' ? '.sheet-scroll' : '.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
    await expect.poll(()=>scroller.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(180)
    if (format !== 'desktop') {
      await first.dispatchEvent('wheel',{deltaY:40,deltaX:0})
      await expect.poll(()=>scroller.evaluate(node=>node.scrollTop)).toBeGreaterThan(0)
      await scroller.evaluate(node=>{node.scrollTop=0})
      const button=await first.boundingBox(),cdp=await page.context().newCDPSession(page)
      const x=button.x+button.width/2,y=button.y+button.height/2
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
      for(const distance of [10,25,40]) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
      await expect.poll(()=>scroller.evaluate(node=>node.scrollTop)).toBeGreaterThan(0)
    }
    await scroller.evaluate(node => { node.scrollTop = 180 })
    await expectContinuousHeader(page)
    if (format === 'desktop') {
      await expect.poll(async () => (await navigation.boundingBox()).y).toBeCloseTo(initialNavigationY,0)
    } else {
      await expect.poll(async () => (await navigation.boundingBox()).y).toBeCloseTo(initialNavigationY,0)
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(api.writes).toEqual([])
    await testInfo.attach(`header-${format}`, { body: await page.screenshot(), contentType: 'image/png' })
  })
}

test('desktop tabs replace only the central section and retain both side columns', async ({ page }) => {
  const api = await openSheet(page, 1440)
  await page.locator('.dnd-desktop-stats').evaluate(node => { window.originalStatsColumn = node })
  await page.locator('.dnd-desktop-utilities').evaluate(node => { window.originalUtilitiesColumn = node })
  const reads = api.requests.filter(path => path === '/api/char/test').length
  const nav = page.getByRole('navigation', { name: 'Раздел персонажа' })
  for (const [label, section] of [['Магия', 'spells'], ['Личность', 'personality'], ['Оружие', 'weapons']]) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator(`.dnd-desktop-main [data-sheet-section="${section}"]:visible`)).toBeVisible()
    expect(await page.evaluate(() => window.originalStatsColumn === document.querySelector('.dnd-desktop-stats')
      && window.originalUtilitiesColumn === document.querySelector('.dnd-desktop-utilities'))).toBe(true)
  }
  await expect(page.locator('.dnd-desktop-main [data-tutorial="character-tabs"]')).toHaveCount(1)
  expect(api.requests.filter(path => path === '/api/char/test')).toHaveLength(reads)
  expect(api.writes).toEqual([])
})

for(const withCondition of [false,true])test(`joined desktop navigation stays attached and keeps content reachable (conditions=${withCondition})`,async({page},info)=>{
  const api=await openSheet(page,1440,withCondition)
  const header=page.locator('.character-workspace-header'),nav=page.locator('[data-sheet-navigation]'),scroller=page.locator('.sheet-scroll')
  await expect(header).toHaveClass(/workspace-header--navigation-joined/)
  const fixed=await header.boundingBox()
  await scroller.evaluate(node=>{node.scrollTop=180})
  await expect.poll(async()=>(await nav.boundingBox()).y).toBeCloseTo(fixed.y+fixed.height,0)
  await nav.getByRole('button',{name:'Оружие',exact:true}).click()
  await expect(scroller).toHaveJSProperty('scrollTop',180)
  const curve=await page.locator('.dnd-desktop-navigation').evaluate(node=>({width:getComputedStyle(node,'::before').width,pointer:getComputedStyle(node,'::before').pointerEvents}))
  expect(curve).toEqual({width:'12px',pointer:'none'})
  const target=page.locator('.dnd-desktop-main .inner-tab-pane:visible button').first()
  await target.evaluate(node=>node.scrollIntoView({block:'start'}))
  expect((await target.boundingBox()).y).toBeGreaterThanOrEqual((await nav.boundingBox()).y+(await nav.boundingBox()).height)
  expect(api.writes).toEqual([])
  await info.attach(`joined-desktop-${withCondition}`,{body:await page.screenshot(),contentType:'image/png'})
})

for(const width of [390,834,1440])for(const withCondition of [false,true])test(`fold dividers separate visible header rows at ${width} (conditions=${withCondition})`,async({page})=>{
  const api=await openSheet(page,width,withCondition)
  const header=page.locator('.character-workspace-header')
  const bar=page.locator('[data-sheet-navigation]').locator('xpath=..')
  await expect(page.locator('.workspace-subheader .workspace-row-divider')).toBeVisible()
  const separate=withCondition && !(await header.evaluate(n=>n.classList.contains('workspace-header--context-inline')))
  await expect(page.locator('.workspace-row-divider:visible')).toHaveCount(separate?2:1)
  for(const divider of await page.locator('.workspace-row-divider:visible').all())await expect(divider).toHaveCSS('pointer-events','none')
  const before=await bar.boundingBox()
  await page.locator('[data-sheet-navigation]').getByRole('button',{name:'Магия',exact:true}).click()
  await expect(page.locator('[data-sheet-section="spells"]:visible')).toBeVisible()
  expect((await bar.boundingBox()).height).toBe(before.height)
  expect(api.writes).toEqual([])
})

test('resizing changes presentation while retaining the selected section and document', async ({ page }) => {
  const api = await openSheet(page, 834)
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Магия', exact: true }).click()
  await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
  await page.locator('[data-sheet-navigation] [aria-current="page"]').focus()
  await page.locator('[data-sheet-navigation]').evaluate(node => { window.sharedSheetNavigation = node })
  const reads = api.requests.filter(path => path === '/api/char/test').length
  for (const width of [1440, 390, 834, 1200, 834]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
    await expect(page.locator('[data-sheet-section="spells"]:visible')).toBeVisible()
    expect(await page.evaluate(() => window.sharedSheetNavigation === document.querySelector('[data-sheet-navigation]'))).toBe(true)
    await expect(page.locator('[data-sheet-navigation] [aria-current="page"]'), `focus at ${width}px`).toBeFocused()
    await expectContinuousHeader(page)
  }
  expect(api.requests.filter(path => path === '/api/char/test')).toHaveLength(reads)
  expect(api.writes).toEqual([])
})

test('Android safe area keeps the docked bar below the main header', async ({ page }) => {
  await openSheet(page, 390)
  await page.evaluate(() => {
    document.documentElement.dataset.platform = 'android'
    document.documentElement.style.setProperty('--native-safe-top', '24px')
  })
  await expect(page.locator('.character-workspace-header')).toHaveCSS('padding-top', '24px')
  await expectContinuousHeader(page)
})

test('the modal desktop sheet uses the same local central navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
  const modal = page.locator('.csm')
  const nav = modal.locator('.dnd-desktop-main [data-sheet-navigation="tablet"]')
  await expect(nav).toBeVisible()
  await nav.getByRole('button', { name: 'Магия', exact: true }).click()
  await expect(modal.locator('.dnd-desktop-main [data-sheet-section="spells"]:visible')).toBeVisible()
  await expect(modal.locator('.dnd-desktop-stats')).toBeVisible()
  await expect(modal.locator('.dnd-desktop-utilities')).toBeVisible()
  for (const width of [834, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(modal.locator('[data-tutorial="character-tabs"]')).toHaveCount(1)
    await expect(modal.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
    await expect(modal.locator('[data-sheet-section="spells"]:visible')).toBeVisible()
    await expectContinuousHeader(page)
  }
})
