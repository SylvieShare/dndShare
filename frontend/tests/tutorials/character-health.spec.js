import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

test('temporary health remains visible as a blue fill and an explicit number', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const api = await fixture(page)
  api.document().values.hp.temp = 5
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const health = page.locator('.heading-health')
  await expect(health).toHaveAttribute('aria-valuetext', '18 из 23, временные 5')
  await expect(health.locator('.health-temporary')).toHaveText('+5')
  await expect.poll(() => health.locator('canvas').evaluate(node => {
    const pixel = node.getContext('2d').getImageData(Math.floor(node.width * .9), Math.floor(node.height * .5), 1, 1).data
    return pixel[2] > pixel[0] && pixel[3] > 0
  })).toBe(true)
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
