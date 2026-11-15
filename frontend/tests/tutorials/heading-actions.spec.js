import { expect, test } from '@playwright/test'
import { checkHeadingActions } from './fixtures/heading-actions.js'

for (const width of [475, 704, 1440]) test(`heading metrics open their own controls at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 932 })
  await checkHeadingActions(page, { width })
})
test('heading preserves reader permissions for armor, health and passive descriptions', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 932 })
  await checkHeadingActions(page, { width: 475, owner: false })
})

test('modal sheet header opens metric dialogs and its dice menu', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 932 })
  await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
  const header = page.locator('.character-workspace-header')
  await expect(header.getByRole('group', { name: 'Показатели персонажа', exact: true })).toBeVisible()
  await header.getByRole('button', { name: 'Инициатива', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Инициатива', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await header.getByRole('button', { name: 'Кубики персонажа', exact: true }).click()
  const dice = page.getByRole('menu', { name: 'Кубики', exact: true })
  await expect(dice.getByRole('menuitem')).toHaveCount(7)
  await dice.getByRole('menuitem', { name: 'Бросить d6', exact: true }).click()
  await expect(dice).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(834)
})
