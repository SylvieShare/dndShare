import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

for (const width of [390, 834, 1440]) test(`temporary health is separate inside the vessel at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const api = await fixture(page)
  api.document().values.hp.temp = 5
  api.document().values.hp.current = 9
  api.document().values.hp.max.base = 18
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const health = page.locator('.heading-health')
  await expect(health).toHaveAttribute('aria-valuetext', '9 из 18, временные 5')
  await expect(health.locator('.health-temporary')).toHaveText('+5')
  const box = await health.locator('.health-track').boundingBox()
  for (const part of ['.health-readout', '.health-heart', '.health-temporary']) {
    const rect = await health.locator(part).boundingBox()
    expect(rect.x).toBeGreaterThan(box.x)
    expect(rect.y).toBeGreaterThan(box.y)
    expect(rect.x + rect.width).toBeLessThan(box.x + box.width)
    expect(rect.y + rect.height).toBeLessThan(box.y + box.height)
  }
  const main = await health.locator('.health-readout').boundingBox(), reserve = await health.locator('.health-temporary').boundingBox()
  expect(reserve.x).toBeGreaterThan(main.x + main.width)
  await expect.poll(() => health.locator('canvas').evaluate(node => {
    const pixel = node.getContext('2d').getImageData(Math.floor(node.width * .65), Math.floor(node.height * .5), 1, 1).data
    return pixel[2] > pixel[0] && pixel[3] > 0
  })).toBe(true)
  await testInfo.attach('health-overlay', { body: await page.locator('.character-workspace-header').screenshot(), contentType: 'image/png' })
})

test('identity details move to the menu and health mist respects reduced motion', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const api = await fixture(page)
  api.document().values.race = { name: 'Полуэльф' }
  api.document().values.classes = [{ name: 'Плут', level: 3 }]
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const heading = page.locator('.dnd-heading')
  await expect(heading).not.toContainText('Полуэльф')
  await expect(heading).not.toContainText('Плут')
  await expect(heading).not.toContainText('ур.')
  await expect(heading.locator('.health-heart')).toBeVisible()
  const canvas = heading.locator('canvas')
  const image = () => canvas.evaluate(node => node.toDataURL())
  const initial = await image()
  await expect.poll(async () => (await image()) !== initial).toBe(true)
  await heading.click()
  await expect(page.locator('.ram-heading')).toContainText('Полуэльф')
  await expect(page.locator('.ram-heading')).toContainText('Плут')
  await expect(page.locator('.ram-heading')).toContainText('3 ур.')
  await page.getByRole('menuitem', { name: 'Изменить HP', exact: true }).click()
  const health = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  await health.getByRole('button', { name: '4', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('14 / 23')
  await expect.poll(() => api.document().values.hp.current).toBe(14)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const still = await image()
  await page.waitForTimeout(200)
  expect(await image()).toBe(still)
  await health.getByRole('button', { name: '2', exact: true }).click()
  await health.getByRole('button', { name: '0', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('0 / 23')
  expect(await canvas.evaluate(node => {
    const pixels = node.getContext('2d').getImageData(0, 0, node.width, node.height).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  })).toBe(false)
  expect(errors).toEqual([])
})

test('hiding and resuming the page preserves the mist phase', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const canvas = page.locator('.heading-health canvas')
  await expect(canvas).toBeVisible()
  // Let initial settling finish; this scenario isolates the ambient clock.
  await page.waitForTimeout(1250)
  const paused = await canvas.evaluate(node => {
    const before = node.toDataURL()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    return { before, after: node.toDataURL() }
  })
  expect(paused.after).toBe(paused.before)
  await page.waitForTimeout(200)
  expect(await canvas.evaluate(node => node.toDataURL())).toBe(paused.after)
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => canvas.evaluate(node => node.toDataURL())).not.toBe(paused.after)
})
