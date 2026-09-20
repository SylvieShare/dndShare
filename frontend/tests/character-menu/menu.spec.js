import { expect, test } from '@playwright/test'

async function open(page, query = '') {
  await page.goto('/tests/character-menu/fixture.html' + query)
  await page.getByRole('button', { name: query.includes('mobile') ? 'Меню' : 'Меню персонажа', exact: true }).click()
  await expect(page.locator('[data-tutorial="character-menu"]')).toBeVisible()
}
async function assertBounds(page) {
  await expect.poll(async () => {
    const box = await page.locator('.base-popover').boundingBox(), viewport = page.viewportSize()
    return box && box.x >= 7 && box.y >= 7 && box.x + box.width <= viewport.width - 7 && box.y + box.height <= viewport.height - 7
  }).toBe(true)
  const bounds = await page.locator('.base-popover').boundingBox()
  const viewport = page.viewportSize()
  expect(bounds.x).toBeGreaterThanOrEqual(7)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 7)
  expect(bounds.y).toBeGreaterThanOrEqual(7)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 7)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const mobile of [false, true]) {
  test(`menu stays within viewport and resizes: ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 360 : 1000, height: 650 })
    await open(page, mobile ? '?mobile' : '')
    await assertBounds(page)
    await page.setViewportSize({ width: 320, height: 200 })
    await expect(page.locator('.base-popover')).toBeVisible()
    await expect.poll(async () => (await page.locator('.base-popover').boundingBox()).y).toBeGreaterThanOrEqual(7)
    await assertBounds(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.base-popover')).not.toBeVisible()
    await page.getByRole('button', { name: mobile ? 'Меню' : 'Меню персонажа', exact: true }).click()
    await page.locator('output').first().click()
    await expect(page.locator('.base-popover')).not.toBeVisible()
  })
}
test('edition list highlights current, cancel is safe, confirm persists without changing global context', async ({ page }) => {
  let requests = 0
  await page.route('**/api/char/fixture/edition', async route => {
    requests++
    expect(await page.evaluate(() => window.flushed)).toBe(true)
    expect(route.request().postDataJSON()).toEqual({ sourceVersionId: 20, version: 5, confirmed: true })
    await route.fulfill({ json: { sourceVersionId: 20, version: 6 } })
  })
  await open(page)
  await page.getByRole('button', { name: 'Сменить редакцию', exact: true }).click()
  await expect(page.locator('.base-popover')).not.toBeVisible()
  await expect(page.locator('[aria-current="true"]')).toContainText('2014')
  await expect(page.locator('.edition-list')).not.toContainText('Vampire')
  await page.getByRole('button', { name: /2014.*Текущая/ }).click()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: /2024.*Перейти/ }).click()
  await expect(page.getByText(/без автоматического переноса/)).toBeVisible()
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: /2024.*Перейти/ }).click()
  await page.getByRole('dialog', { name: 'Перейти на D&D 5e · 2024?' }).getByRole('button', { name: 'Сменить редакцию', exact: true }).click()
  await expect(page.getByTestId('edition')).toHaveText('20')
  await expect(page.getByTestId('global')).toHaveText('30')
  expect(requests).toBe(1)
  await page.getByRole('button', { name: 'Меню персонажа', exact: true }).click()
  await page.getByRole('button', { name: 'Сменить редакцию', exact: true }).click()
  await expect(page.locator('[aria-current="true"]')).toContainText('2024')
})
for (const query of ['?single', '?readonly', '?mobile&single']) {
  test(`edition change hidden ${query}`, async ({ page }) => {
    await open(page, query)
    await expect(page.getByRole('button', { name: 'Сменить редакцию', exact: true })).toHaveCount(0)
  })
}
test('failed autosave keeps current edition and displays actionable error', async ({ page }) => {
  await open(page, '?saveError')
  await page.getByRole('button', { name: 'Сменить редакцию', exact: true }).click()
  await page.getByRole('button', { name: /2024.*Перейти/ }).click()
  await page.getByRole('dialog', { name: 'Перейти на D&D 5e · 2024?' }).getByRole('button', { name: 'Сменить редакцию', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить лист')
  await expect(page.getByTestId('edition')).toHaveText('10')
})
