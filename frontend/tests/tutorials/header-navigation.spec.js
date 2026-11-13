import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function openSheet(page, width) {
  await page.setViewportSize({ width, height: 600 })
  const api = await fixture(page)
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
  await expect(page.locator('.character-workspace-header .workspace-subheader')).toHaveCount(0)
  if (await page.locator('.dnd-desktop-navigation').count()) {
    const header = page.locator('.character-workspace-header')
    await expect(header.locator('.workspace-subheader')).toHaveCount(0)
    const navigation = page.locator('.dnd-desktop-navigation [data-sheet-navigation]')
    await expect(navigation).toBeVisible()
    const geometry = await navigation.evaluate(node => {
      const nav = node.getBoundingClientRect(), main = node.closest('.dnd-desktop-main').getBoundingClientRect()
      return { start: nav.left - main.left, end: main.right - nav.right, overflow: getComputedStyle(node).overflowX,
        background: getComputedStyle(node.closest('.dnd-desktop-navigation')).backgroundColor,
        shadow: getComputedStyle(node.closest('.workspace-subheader-inner')).boxShadow }
    })
    expect(geometry.start).toBeGreaterThanOrEqual(-1)
    expect(geometry.end).toBeGreaterThanOrEqual(-1)
    expect(geometry.overflow).toBe('auto')
    expect(geometry.background).toBe('rgba(0, 0, 0, 0)')
    expect(geometry.shadow).not.toBe('none')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
    return
  }
  const geometry = await page.locator('.mobile-sheet-navigation').evaluate(host => {
    const pane=host.parentElement.querySelector('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
    const band=host.querySelector('.workspace-subheader'),surface=band.querySelector('.workspace-subheader-inner')
    const a=host.getBoundingClientRect(),b=pane.getBoundingClientRect(),c=surface.getBoundingClientRect()
    return { gap:a.top-b.top,inset:parseFloat(getComputedStyle(pane).paddingTop),height:a.height,
      scrollbarInset:parseFloat(getComputedStyle(pane,'::-webkit-scrollbar-track').marginTop),
      background:getComputedStyle(host).backgroundColor,bandBackground:getComputedStyle(band).backgroundColor,
      leftInset:c.left-a.left,rightInset:a.right-c.right,surfaceBackground:getComputedStyle(surface).backgroundColor,
      shadow:getComputedStyle(surface).boxShadow,radius:getComputedStyle(surface).borderTopLeftRadius }
  })
  expect(Math.abs(geometry.gap)).toBeLessThan(.5)
  expect(geometry.inset).toBeCloseTo(geometry.height,0)
  expect(geometry.scrollbarInset).toBeCloseTo(geometry.height,0)
  expect(geometry.background).toBe('rgba(0, 0, 0, 0)')
  expect(geometry.bandBackground).toBe('rgba(0, 0, 0, 0)')
  expect(geometry.shadow).not.toBe('none')
  expect(geometry.surfaceBackground).toBe('rgb(48, 45, 58)')
  expect(geometry.leftInset).toBeGreaterThan(0)
  expect(geometry.rightInset).toBeGreaterThan(0)
  expect(parseFloat(geometry.radius)).toBeGreaterThan(8)
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
      const scrollTop=await scroller.evaluate(node=>node.scrollTop)
      await expect.poll(async () => (await navigation.boundingBox()).y).toBeCloseTo(initialNavigationY-scrollTop,0)
    } else {
      const surface=await page.locator('.mobile-sheet-navigation .workspace-subheader-inner').boundingBox()
      expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.character-sheet'),
        {x:surface.x+1,y:surface.y+1})).toBe(true)
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

test('Android safe area keeps the floating tabs below the main header', async ({ page }) => {
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
