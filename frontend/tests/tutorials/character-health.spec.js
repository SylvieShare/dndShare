import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

for (const width of [390, 834, 1440]) test(`HP and armor share one simple row at ${width}`, async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  const api = await fixture(page)
  Object.assign(api.document().values.hp, { current: 9, max: { base: 18, bonuses: [] }, temp: 5 })
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const heading = page.locator('.dnd-heading'), health = heading.locator('.heading-health')
  await expect(health).toHaveAttribute('aria-label', 'Здоровье: 9 из 18, временные 5')
  await expect(health.locator('.health-readout')).toHaveText('9/18')
  await expect(health.locator('.health-temporary')).toHaveText('+5')
  await expect(health.locator('.health-heart')).toBeVisible()
  await expect(heading.locator('canvas,.health-track')).toHaveCount(0)
  const fields = await heading.locator('.heading-metrics > span').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { left: box.left, right: box.right, middle: box.y + box.height / 2 }
  }))
  expect(fields).toHaveLength(4)
  for (const field of fields) expect(Math.abs(field.middle - fields[0].middle)).toBeLessThan(1)
  expect(fields[0].right).toBeLessThan(fields[1].left)
  const box = await heading.boundingBox()
  expect(box.width).toBeLessThanOrEqual(420)
  expect(fields[3].right).toBeLessThanOrEqual(box.x + box.width + 1)
  await testInfo.attach('inline-health', { body: await page.locator('.character-workspace-header').screenshot(), contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('the simple counter retains menu edits and death saves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const api = await fixture(page)
  api.document().values.race = { name: 'Полуэльф' }
  api.document().values.classes = [{ name: 'Плут', level: 3 }]
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const heading = page.locator('.dnd-heading')
  await expect(heading).not.toContainText('Полуэльф')
  await heading.click()
  await expect(page.locator('.ram-heading')).toContainText('Полуэльф')
  await page.getByRole('menuitem', { name: 'Изменить HP', exact: true }).click()
  const health = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  await health.getByRole('button', { name: '4', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('14/23')
  await expect.poll(() => api.document().values.hp.current).toBe(14)
  await health.getByRole('button', { name: '2', exact: true }).click()
  await health.getByRole('button', { name: '0', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('0/23')
  await expect(health.getByRole('button', { name: 'Успехи: 1' })).toBeVisible()
})
