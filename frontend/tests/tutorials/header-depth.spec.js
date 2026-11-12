import { expect, test } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function open(page, width) {
  await page.setViewportSize({ width, height: 600 })
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [],
    metadata: { types: [], suggests: {}, suggestTypes: [], books: [] },
  } }))
  await page.goto('/char/test')
  await expect(page.locator('[data-sheet-navigation]')).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  return api
}
const header = page => page.locator('.character-workspace-header')
const pane = page => page.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
const opacity = page => header(page).evaluate(node => Number(getComputedStyle(node, '::after').opacity))
const expectDepth = (page, value) => expect.poll(() => opacity(page)).toBeCloseTo(value, 2)

for (const width of [390, 834, 1440]) test(`the shared header shadow follows the first 16 scroll pixels at ${width}`, async ({ page }, testInfo) => {
  const api = await open(page, width)
  const scroller = width < 1200 ? pane(page) : page.locator('.sheet-scroll')
  await expect.poll(() => scroller.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(16)
  const initial = await header(page).boundingBox()
  await expectDepth(page, 0)
  await scroller.evaluate(node => { node.scrollTop = 8 })
  await expectDepth(page, .5)
  await scroller.evaluate(node => { node.scrollTop = 180 })
  await expectDepth(page, 1)
  expect((await header(page).boundingBox()).height).toBeCloseTo(initial.height, 0)
  const decoration = await header(page).evaluate(node => {
    const style = getComputedStyle(node, '::after')
    return { height: style.height, pointerEvents: style.pointerEvents }
  })
  expect(decoration).toEqual({ height: '12px', pointerEvents: 'none' })
  await testInfo.attach(`header-depth-${width}`, { body: await page.screenshot(), contentType: 'image/png' })
  await scroller.evaluate(node => { node.scrollTop = 0 })
  await expectDepth(page, 0)
  expect(api.writes).toEqual([])
})

for (const width of [390, 834]) test(`shadow follows only the active pane and restores its position at ${width}`, async ({ page }) => {
  await open(page, width)
  await pane(page).evaluate(node => { node.dataset.scrollOwner = 'stats'; node.scrollTop = 40 })
  await expectDepth(page, 1)
  await page.locator('[data-sheet-navigation]').getByRole('button', { name: 'Оружие', exact: true }).click()
  await expectDepth(page, 0)
  await page.locator('[data-scroll-owner="stats"]').evaluate(node => { node.scrollTop = 80 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expectDepth(page, 0)
  await page.locator('[data-sheet-navigation]').getByRole('button', { name: 'Статы', exact: true }).click()
  await expectDepth(page, 1)
  expect(await pane(page).evaluate(node => node.scrollTop)).toBe(80)
})

for (const width of [600, 834, 1199]) test(`tablet captions keep 12px text and size buttons by content at ${width}`, async ({ page }) => {
  await open(page, width)
  const nav = page.locator('[data-sheet-navigation="tablet"]')
  const captions = await nav.locator('.share-icon-navigation__label').evaluateAll(nodes => nodes.map(node => {
    const range = document.createRange(); range.selectNodeContents(node)
    return { font: getComputedStyle(node).fontSize, height: getComputedStyle(node).lineHeight,
      textWidth: range.getBoundingClientRect().width, available: node.getBoundingClientRect().width }
  }))
  expect(captions).toHaveLength(7)
  for (const caption of captions) {
    expect(caption.font).toBe('12px')
    expect(caption.height).toBe('14px')
    expect(caption.textWidth).toBeLessThanOrEqual(caption.available + .5)
  }
  const long = await nav.getByRole('button', { name: 'Способности', exact: true }).boundingBox()
  const short = await nav.getByRole('button', { name: 'Магия', exact: true }).boundingBox()
  expect(long.width).toBeGreaterThan(short.width)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
})

for (const width of [834, 1440]) test(`modal header uses the same scroll depth at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 400 })
  await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
  await expect(header(page)).toBeVisible()
  await expectDepth(page, 0)
  const scroller = width < 1200 ? pane(page) : page.locator('.csm-body')
  await expect.poll(() => scroller.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(16)
  await scroller.evaluate(node => { node.scrollTop = 16 })
  await expectDepth(page, 1)
  await scroller.evaluate(node => { node.scrollTop = 0 })
  await expectDepth(page, 0)
})

test('reduced motion keeps scroll depth functional without a timed fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 390)
  expect(await header(page).evaluate(node => getComputedStyle(node, '::after').transitionDuration)).toBe('0s')
  await pane(page).evaluate(node => { node.scrollTop = 8 })
  await expectDepth(page, .5)
})
