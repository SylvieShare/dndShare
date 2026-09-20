import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) test(`maps preview access ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 })
  await page.goto(`/tests/maps/fixtures/access.html?${mobile ? 'mobile' : ''}`)
  if (mobile) await page.getByRole('button', { name: 'DnD Share' }).click()
  const library = page.getByRole('button', { name: 'Карты', exact: true })
  await expect(library).toHaveAttribute('aria-disabled', 'true')
  await library.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Скоро будет')
  await library.dispatchEvent('click')
  expect(await page.evaluate(() => window.mapReads)).toBe(0)
  await page.mouse.move(0, 0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const tab = page.getByRole('button', { name: 'Карта', exact: true })
  await tab.focus()
  await expect(page.getByRole('tooltip')).toHaveText('Скоро будет')
  await tab.press('Enter')
  expect(await page.evaluate(() => window.selectedView)).toBe('')

  await page.goto(`/tests/maps/fixtures/access.html?admin&${mobile ? 'mobile' : ''}`)
  if (mobile) await page.getByRole('button', { name: 'DnD Share' }).click()
  await expect(page.getByRole('link', { name: 'Карты', exact: true })).toHaveAttribute('href', '/maps')
  await page.getByRole('button', { name: 'Карта', exact: true }).click()
  expect(await page.evaluate(() => window.selectedView)).toBe('maps')
  expect(errors).toEqual([])
})

test('direct maps page does not read private data without ADMIN', async ({ page }) => {
  await page.goto('/tests/maps/fixtures/access.html?direct')
  await expect(page.getByRole('status')).toHaveText('Скоро будет')
  expect(await page.evaluate(() => window.mapReads)).toBe(0)
  await page.goto('/tests/maps/fixtures/access.html?direct&admin')
  await expect(page.getByRole('button', { name: 'Создать карту', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.mapReads)).toBe(1)
})
