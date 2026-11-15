import { expect, test } from '@playwright/test'

for (const width of [390, 834, 1440]) test(`beer adds two Wisdom and restores the sheet at ${width}px`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width, height: 950 })
  await page.goto('/tests/tutorials/fixtures/beer-wisdom.html')
  await expect(page.locator('.stat-view')).toContainText('16')
  await expect(page.getByTestId('passive')).toHaveText('15')
  await page.getByRole('button', { name: 'Выпить пиво', exact: true }).click()
  await expect(page.locator('.stat-view')).toContainText('18')
  await expect(page.getByTestId('passive')).toHaveText('16')
  await page.getByRole('button', { name: 'Выпить пиво', exact: true }).click()
  await expect(page.getByTestId('states')).toHaveText('1')
  for (const [name, bonus] of [['Мудрость — проверка', 4], ['Мудрость — спасбросок', 6], ['Внимание — проверка', 6]]) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
    expect(await page.evaluate(() => window.rolls.at(-1).bonus)).toBe(bonus)
  }
  expect(await page.evaluate(() => window.beerValues.WIS.value)).toEqual({ base: 16, bonuses: [] })
  await page.getByRole('button', { name: 'Снять состояние', exact: true }).click()
  await expect(page.locator('.stat-view')).toContainText('16')
  await expect(page.getByTestId('passive')).toHaveText('15')
  await page.getByRole('button', { name: 'Мудрость — проверка', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
  expect(await page.evaluate(() => window.rolls.at(-1).bonus)).toBe(3)
})
