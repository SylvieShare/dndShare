import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = { items: [] }
    if (path === '/api/items/by-ids') json = { items: [{ id: 7107, typeId: 7, name: 'Дикий атакующий', data: { category: 'origin', description: '<p>Перебросьте кости урона оружия и выберите результат.</p>' } }] }
    if (path === '/api/item-types') json = { types: [{ id: 7, name: 'Черты', fields: [] }] }
    await route.fulfill({ json })
  })
})

for (const width of [1400, 390]) {
  test(`origin allocations stay valid and feat opens as reference (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/origin-choices/fixture.html')
    await page.getByRole('button', { name: 'Сила +2', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ловкость +2', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Сила +1', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Выносливость +1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ловкость +1', exact: true })).toBeDisabled()
    await expect(page.getByTestId('complete')).toHaveText('true')
    await page.getByRole('button', { name: /Дикий атакующий/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Перебросьте кости урона оружия')
    await expect(page.getByRole('dialog')).toContainText('Черта происхождения')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    expect(await page.evaluate(() => window.state.backgroundAsi)).toEqual({ STR: 2, CON: 1 })
    await page.getByRole('radio', { name: '+1 / +1 / +1', exact: true }).click()
    await expect(page.getByTestId('complete')).toHaveText('false')
    for (const name of ['Сила +1', 'Ловкость +1', 'Выносливость +1']) await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByTestId('complete')).toHaveText('true')
    await page.getByRole('button', { name: 'Сменить предысторию', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Сила +1', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => window.state.backgroundAsi)).toEqual({})
  })
  test(`2014 racial allocation uses the same bounded selector (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/origin-choices/fixture.html?race')
    await page.getByRole('button', { name: 'Сила +1', exact: true }).click()
    await page.getByRole('button', { name: 'Харизма +1', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ловкость +1', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Сила +1', exact: true }).click()
    await page.getByRole('button', { name: 'Ловкость +1', exact: true }).click()
    expect(await page.evaluate(() => window.state.asiChoice)).toEqual(['CHA', 'DEX'])
  })
}
test('restores the +1/+1/+1 mode from a saved draft', async ({ page }) => {
  await page.goto('/tests/origin-choices/fixture.html?restore')
  await expect(page.getByRole('radio', { name: '+1 / +1 / +1', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('complete')).toHaveText('true')
})
test('level-up bonuses respect the score cap before selection', async ({ page }) => {
  await page.goto('/tests/origin-choices/fixture.html?level')
  await expect(page.getByRole('button', { name: 'Сила +2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Выносливость +2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Ловкость +2', exact: true }).click()
  expect(await page.evaluate(() => window.state.backgroundAsi)).toEqual({ DEX: 2 })
  await page.getByRole('radio', { name: '+1 / +1', exact: true }).click()
  await page.getByRole('button', { name: 'Сила +1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выносливость +1', exact: true })).toBeDisabled()
})
