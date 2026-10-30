import { test, expect } from '@playwright/test'
for (const [viewport, width] of [[390, 282], [834, 340], [1440, 550]]) {
  test(`weapon table keeps readable labelled cells at ${viewport}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 900 })
    await page.goto('/tests/weapon-charges/weapon-metrics.html')
    await page.locator('main').evaluate((element, width) => { element.style.width = width + 'px' }, width)
    const table = page.getByRole('group', { name: 'Показатели оружия' })
    await expect(table.locator('.weapon-metrics__label')).toHaveText(['Атака', 'Урон', 'Свойства'])
    await expect(table).toHaveCSS('border-top-width', '0px')
    await expect(table.locator('.weapon-metrics__attack')).toHaveCSS('border-top-left-radius', '10px')
    await expect(table.locator('.weapon-metrics__bonus')).toHaveCSS('font-size', '28px')
    await expect(table.locator('.weapon-metrics__property-list')).toHaveCSS('font-size', '14px')
    await expect(table.locator('.ad-atk')).toHaveCount(0)
    const attack = await table.locator('.weapon-metrics__attack').boundingBox()
    const damage = await table.locator('.weapon-metrics__damage').boundingBox()
    const properties = await table.locator('.weapon-metrics__properties').boundingBox()
    expect(attack.y).toBe(damage.y)
    const value = await table.locator('.weapon-metrics__bonus').boundingBox()
    expect(value.x + value.width / 2).toBeCloseTo(attack.x + attack.width / 2, 0)
    expect(value.y + value.height / 2).toBeCloseTo(attack.y + attack.height / 2, 0)
    if (width === 282) expect(properties.y).toBeGreaterThan(damage.y + damage.height)
    else if (width === 550) expect(properties.y).toBe(attack.y)
    expect(await table.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
    await table.getByText('Универсальное', { exact: true }).focus()
    await expect.poll(() => page.evaluate(() => window.propertyEvents.at(-1))).toBe('Универсальное')
    await table.getByRole('button', { name: 'Универсальное', exact: true }).click()
    const popup = page.getByRole('dialog', { name: 'Универсальное', exact: true })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText('Две руки')
    expect(await page.evaluate(() => window.parentClicks)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(popup).not.toBeVisible()
    await page.evaluate(() => {
      window.metricsData.twoHandedParts = []
      window.metricsData.damageParts = Array.from({ length: 6 }, (_, i) => ({ count: 1, diceSides: i % 2 ? 8 : 6, type: 'Дробящий', typeColor: '#fbbf24' }))
    })
    const cell = table.locator('.weapon-metrics__damage')
    expect(await cell.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
  })
}


test('same narrow card fits a simple weapon in one row and hides absent properties', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/tests/weapon-charges/weapon-metrics.html')
  await page.locator('main').evaluate(e => { e.style.width = '282px' })
  await page.evaluate(() => {
    Object.assign(window.metricsData, {
      modifier: 0, twoHandedParts: [],
      damageParts: [{ count: 1, diceSides: 6, type: 'Колющий', typeColor: '#94a3b8' }],
      properties: [{ id: 2, label: 'Метательное', desc: 'Можно метнуть.' }],
    })
  })
  const table = page.getByRole('group', { name: 'Показатели оружия' })
  const attack = table.locator('.weapon-metrics__attack')
  const property = table.locator('.weapon-metrics__properties')
  await expect.poll(async () => (await property.boundingBox()).y).toBe((await attack.boundingBox()).y)
  await table.getByRole('button', { name: 'Метательное' }).click()
  await expect(page.getByRole('dialog', { name: 'Метательное' })).toContainText('Можно метнуть.')
  await page.evaluate(() => { window.metricsData.properties = [] })
  await expect(property).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(table.locator('.weapon-metrics__label')).toHaveText(['Атака', 'Урон'])
  const value = await table.locator('.weapon-metrics__bonus').boundingBox(), box = await attack.boundingBox()
  expect(value.x + value.width / 2).toBeCloseTo(box.x + box.width / 2, 0)
  expect(value.y + value.height / 2).toBeCloseTo(box.y + box.height / 2, 0)
  expect(await table.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
})
