import { test, expect } from '@playwright/test'
for (const mobile of [false, true]) test(`shared morph heading and independent aside on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  await page.getByRole('button', { name: 'Ловкость — спасбросок', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  await page.keyboard.press('Escape')
  const heading = page.getByRole('button', { name: 'Редактировать: Ловкость', exact: true })
  await heading.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.mes-editor')).toBeVisible()
  await expect(page.locator('.mes-view .morph-tile-header')).toBeVisible()
  await expect(page.locator('.mes-view .morph-tile-heading')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  expect(await page.evaluate(() => window.writes)).toEqual([])
})

test('compact utility headings and values stay within the 64px grid rows', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  const tiles = page.getByTestId('utility-grid').locator('.util-tile')
  await expect(tiles).toHaveCount(4)
  for (const tile of await tiles.all()) {
    const bounds = await tile.boundingBox()
    expect(bounds.height).toBe(64)
    await expect(tile.locator('.morph-tile-header--compact')).toHaveCount(1)
    for (const part of await tile.locator('.morph-tile-title, .morph-tile-pencil, .stf-body, .stf-val, .stf-roll').all()) {
      const inner = await part.boundingBox()
      expect(inner.y).toBeGreaterThanOrEqual(bounds.y)
      expect(inner.y + inner.height).toBeLessThanOrEqual(bounds.y + bounds.height)
      expect(inner.x + inner.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    }
    expect(await tile.locator('.morph-tile-header').evaluate(el => getComputedStyle(el).marginBottom)).toBe('0px')
  }
  expect(await page.locator('.stat-body').evaluate(el => getComputedStyle(el).paddingTop)).toBe('8px')
})
