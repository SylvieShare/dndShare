import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function openSheet(page, width) {
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [],
    metadata: { types: [], suggests: {}, suggestTypes: [], books: [] },
  } }))
  await page.goto('/char/test')
  await expect(page.locator('[data-sheet-navigation]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return api
}

async function expectContinuousHeader(page) {
  const geometry = await page.locator('.character-workspace-header').evaluate(header => {
    const main = header.querySelector('.workspace-header-inner'), band = header.querySelector('.workspace-subheader')
    const a = main.getBoundingClientRect(), b = band.getBoundingClientRect(), root = header.getBoundingClientRect(),surface=band.querySelector('.workspace-subheader-inner'),c=surface.getBoundingClientRect()
    return { gap: b.top - a.bottom, bottom: root.bottom - b.bottom,
      mainBackground: getComputedStyle(header).backgroundColor, bandBackground: getComputedStyle(band).backgroundColor,
      border: getComputedStyle(band).borderTopWidth,
      leftInset:c.left-b.left,rightInset:b.right-c.right,surfaceBackground:getComputedStyle(surface).backgroundColor,radius:getComputedStyle(surface).borderTopLeftRadius,
      seamBelongsToHeader: header.contains(document.elementFromPoint(root.x + root.width / 2, b.top + .5)) }
  })
  expect(Math.abs(geometry.gap)).toBeLessThan(.5)
  expect(Math.abs(geometry.bottom)).toBeLessThan(.5)
  expect(geometry.bandBackground).not.toBe('rgba(0, 0, 0, 0)')
  expect(geometry.bandBackground).not.toBe(geometry.mainBackground)
  expect(geometry.border).toBe('0px')
  expect(geometry.bandBackground).toBe('rgb(23, 23, 27)')
  expect(geometry.surfaceBackground).toBe('rgb(48, 45, 58)')
  expect(geometry.leftInset).toBeGreaterThan(0)
  expect(geometry.rightInset).toBeGreaterThan(0)
  expect(parseFloat(geometry.radius)).toBeGreaterThan(8)
  expect(geometry.seamBelongsToHeader).toBe(true)
}

for (const [width, format, layout] of [[390, 'phone', 'compact'], [834, 'tablet', 'stacked'], [1440, 'desktop', 'inline']]) {
  test(`one opaque header owns the ${format} navigation`, async ({ page }, testInfo) => {
    const api = await openSheet(page, width)
    const header = page.locator('.character-workspace-header'), navigation = header.locator('[data-sheet-navigation]')
    await expect(navigation).toHaveAttribute('data-sheet-navigation', format)
    await expect(navigation).toHaveClass(new RegExp(`share-icon-navigation--${layout}`))
    await expect(page.locator('[data-tutorial="character-tabs"]')).toHaveCount(1)
    const first = navigation.getByRole('button').first()
    const geometry = await first.evaluate(button => {
      const icon = button.querySelector('.share-icon-navigation__icon').getBoundingClientRect()
      const label = button.querySelector('.share-icon-navigation__label').getBoundingClientRect()
      return { iconWidth: icon.width, iconRight: icon.right, iconBottom: icon.bottom, labelLeft: label.left, labelTop: label.top }
    })
    expect(geometry.iconWidth).toBeCloseTo(format === 'desktop' ? 28 : 22, 0)
    if (format === 'desktop') expect(geometry.labelLeft).toBeGreaterThan(geometry.iconRight)
    else expect(geometry.labelTop).toBeGreaterThanOrEqual(geometry.iconBottom - 1)
    await expectContinuousHeader(page)
    const scroller = page.locator(format === 'desktop' ? '.sheet-scroll' : '.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
    await scroller.evaluate(node => { node.scrollTop = 180 })
    await expectContinuousHeader(page)
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
  await expect(page.locator('.dnd-desktop-main [data-tutorial="character-tabs"]')).toHaveCount(0)
  expect(api.requests.filter(path => path === '/api/char/test')).toHaveLength(reads)
  expect(api.writes).toEqual([])
})

test('resizing changes presentation while retaining the selected section and document', async ({ page }) => {
  const api = await openSheet(page, 834)
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Магия', exact: true }).click()
  await page.locator('[data-sheet-navigation]').evaluate(node => { window.sharedSheetNavigation = node })
  const reads = api.requests.filter(path => path === '/api/char/test').length
  for (const width of [1440, 390, 834]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.locator('[data-sheet-navigation] [aria-current="page"]')).toHaveText('Магия')
    await expect(page.locator('[data-sheet-section="spells"]:visible')).toBeVisible()
    expect(await page.evaluate(() => window.sharedSheetNavigation === document.querySelector('[data-sheet-navigation]'))).toBe(true)
    await expectContinuousHeader(page)
  }
  expect(api.requests.filter(path => path === '/api/char/test')).toHaveLength(reads)
  expect(api.writes).toEqual([])
})

test('Android safe area and subheader remain one opaque surface', async ({ page }) => {
  await openSheet(page, 390)
  await page.evaluate(() => {
    document.documentElement.dataset.platform = 'android'
    document.documentElement.style.setProperty('--native-safe-top', '24px')
  })
  await expect(page.locator('.character-workspace-header')).toHaveCSS('padding-top', '24px')
  await expectContinuousHeader(page)
})

test('the modal desktop sheet uses the same subheader navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
  const modal = page.locator('.csm')
  const nav = modal.locator('.character-workspace-header [data-sheet-navigation="desktop"]')
  await expect(nav).toBeVisible()
  await nav.getByRole('button', { name: 'Магия', exact: true }).click()
  await expect(modal.locator('.dnd-desktop-main [data-sheet-section="spells"]:visible')).toBeVisible()
  await expect(modal.locator('.dnd-desktop-stats')).toBeVisible()
  await expect(modal.locator('.dnd-desktop-utilities')).toBeVisible()
})
