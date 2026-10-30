import { test, expect } from '@playwright/test'
for (const [viewport, width] of [[390, 282], [834, 340], [1440, 550]]) {
  test(`weapon table keeps readable labelled cells at ${viewport}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 900 })
    await page.goto('/tests/weapon-charges/weapon-metrics.html')
    await page.locator('main').evaluate((element, width) => { element.style.width = width + 'px' }, width)
    const table = page.getByRole('group', { name: 'Показатели оружия' })
    await expect(table.locator('.weapon-metrics__label')).toHaveText(['Атака', 'Урон', 'Свойства'])
    await expect(table).toHaveCSS('border-top-color', 'rgb(23, 23, 27)')
    await expect(table).toHaveCSS('border-top-left-radius', '10px')
    await expect(table.locator('.ad-atk')).toHaveCount(0)
    const attack = await table.locator('.weapon-metrics__attack').boundingBox()
    const damage = await table.locator('.weapon-metrics__damage').boundingBox()
    const properties = await table.locator('.weapon-metrics__properties').boundingBox()
    expect(attack.y).toBe(damage.y)
    if (width < 380) expect(properties.y).toBeGreaterThan(damage.y + damage.height)
    else expect(properties.y).toBe(attack.y)
    expect(await table.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
    await table.getByText('Универсальное', { exact: true }).focus()
    await expect.poll(() => page.evaluate(() => window.propertyEvents.at(-1))).toBe('Универсальное')
    await page.evaluate(() => {
      window.metricsData.twoHandedParts = []
      window.metricsData.damageParts = Array.from({ length: 6 }, (_, i) => ({ count: 1, diceSides: i % 2 ? 8 : 6, type: 'Дробящий', typeColor: '#fbbf24' }))
    })
    const cell = table.locator('.weapon-metrics__damage')
    expect(await cell.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
  })
}
