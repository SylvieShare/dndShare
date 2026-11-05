import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

test.use({ hasTouch: true })

async function openSheet(page, width = 390, reducedMotion = 'no-preference') {
  await page.setViewportSize({ width, height: 1100 })
  await page.emulateMedia({ reducedMotion })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.mobile-tab-caption').first()).toHaveCSS('opacity', '1')
  return api
}

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function gesture(page, direction = -1) {
  const client = await page.context().newCDPSession(page)
  const width = await page.locator('.mobile-swipe-track').evaluate(el => el.clientWidth)
  const start = { x: width * (direction < 0 ? .85 : .15), y: 960 }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  return {
    async move(progress) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + direction * width * progress, y: start.y }] })
      await frame(page)
    },
    async end(type = 'touchEnd') {
      await client.send('Input.dispatchTouchEvent', { type, touchPoints: [] })
      await client.detach()
    },
  }
}

const state = page => page.locator('.mobile-tabbar').evaluate(bar => ({
  scroll: bar.scrollLeft,
  tabs: [...bar.querySelectorAll('.mobile-tab-btn')].map(button => {
    const rect = button.getBoundingClientRect(), icon = button.querySelector('.mobile-tab-icon').getBoundingClientRect()
    return { x: rect.x + bar.scrollLeft, width: rect.width, iconX: icon.x + bar.scrollLeft, iconY: icon.y,
      opacity: Number(getComputedStyle(button.querySelector('.mobile-tab-caption')).opacity) }
  }),
}))

for (const width of [390, 590]) test(`icons and captions follow a held swipe continuously at ${width}`, async ({ page }, testInfo) => {
  const api = await openSheet(page, width)
  const initial = await state(page)
  const drag = await gesture(page)
  await drag.move(.25)
  const quarter = await state(page)
  expect(quarter.tabs[0].opacity).toBeCloseTo(.75, 2)
  expect(quarter.tabs[1].opacity).toBeCloseTo(.25, 2)
  expect(quarter.tabs[0].width).toBeLessThan(initial.tabs[0].width)
  expect(quarter.tabs[1].width).toBeGreaterThan(initial.tabs[1].width)
  expect(quarter.tabs[0].iconY).toBeGreaterThan(initial.tabs[0].iconY)
  expect(quarter.tabs[1].iconY).toBeLessThan(initial.tabs[1].iconY)
  // Holding the finger does not run a timed transition to a different selection.
  await page.waitForTimeout(150)
  expect(await state(page)).toEqual(quarter)
  await drag.move(.49)
  const before = await state(page)
  await drag.move(.51)
  const after = await state(page)
  for (const i of [0, 1, 2]) expect(Math.abs(after.tabs[i].iconX - before.tabs[i].iconX)).toBeLessThan(1)
  expect(after.tabs[2].x).toBeCloseTo(initial.tabs[2].x, 1)
  expect(after.tabs[0].opacity).toBeCloseTo(.49, 2)
  expect(after.tabs[1].opacity).toBeCloseTo(.51, 2)
  await expect(page.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
  await testInfo.attach('held-swipe', { body: await page.screenshot(), contentType: 'image/png' })
  await drag.end()
  await expect(page.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.mobile-tab-caption').nth(1)).toHaveCSS('opacity', '1')
  const settled = await state(page)
  expect(settled.tabs[1].width).toBeCloseTo(initial.tabs[0].width, 1)
  expect(settled.tabs[0].width).toBeCloseTo(initial.tabs[1].width, 1)
  expect(api.writes).toEqual([])
})

test('reverse movement and cancellation fade captions back without changing the selected page', async ({ page }) => {
  await openSheet(page)
  const drag = await gesture(page)
  await drag.move(.4)
  await drag.move(.2)
  expect((await state(page)).tabs[1].opacity).toBeCloseTo(.2, 2)
  await drag.end('touchCancel')
  await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  await expect(page.locator('.mobile-tab-caption').first()).toHaveCSS('opacity', '1')
  await expect(page.locator('.mobile-tab-caption').nth(1)).toHaveCSS('opacity', '0')
  await expect(page.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('wrapped swipe fades the first and last labels, and reduced motion settles immediately', async ({ page }) => {
  await openSheet(page, 390, 'reduce')
  const drag = await gesture(page, 1)
  await drag.move(.3)
  const held = await state(page)
  expect(held.tabs[0].opacity).toBeCloseTo(.7, 2)
  expect(held.tabs[7].opacity).toBeCloseTo(.3, 2)
  await drag.end()
  await expect(page.getByRole('button', { name: 'Дневник', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.mobile-tab-caption').last()).toHaveCSS('opacity', '1')
  const transitions = await page.locator('.mobile-tabbar').evaluate(el => [...el.querySelectorAll('button, .mobile-tab-icon, .mobile-tab-caption, .mobile-tab-indicator')].map(node => getComputedStyle(node).transitionDuration))
  expect(transitions.every(value => value === '0s')).toBe(true)
})

test('a quick second selection replaces the in-flight movement', async ({ page }) => {
  await openSheet(page)
  await page.getByRole('button', { name: 'Статы', exact: true }).dispatchEvent('click')
  await expect(page.locator('.mobile-tabbar')).toHaveClass(/settling/)
  await page.getByRole('button', { name: 'Магия', exact: true }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'Магия', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  const final = await state(page)
  expect(final.tabs.map(tab => tab.opacity)).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
})
