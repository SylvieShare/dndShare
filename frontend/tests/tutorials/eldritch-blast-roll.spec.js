import { expect, test } from '@playwright/test'

for (const width of [390, 834, 1440]) {
  for (const session of [true, false]) {
    test(`eldritch blast damage opens at ${width}px ${session ? 'in a session' : 'without a session'}`, async ({ page }) => {
      page.on('pageerror', error => { throw error })
      await page.setViewportSize({ width, height: 950 })
      await page.goto(`/tests/tutorials/fixtures/spell-rolls.html?eldritch${session ? '&session' : ''}`)
      const row = page.locator('.spell-row').filter({ hasText: 'Мистический заряд' })
      await expect(row).toBeVisible()
      await row.locator('.ad-dmg').click()
      const dialog = page.getByRole('dialog', { name: 'Мистический заряд · Урон', exact: true })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Урон одного снаряда/луча. Всего: 2.')).toBeVisible()
      expect(await page.evaluate(() => window.rolls)).toEqual([])
      await dialog.getByRole('button', { name: 'Бросить на урон', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1))).toEqual({ title: 'Урон: Мистический заряд', expression: '1d10{Силовое поле}' })
      await expect(dialog).toHaveCount(0)
      await row.locator('.sp-name').click()
      await page.getByRole('menuitem', { name: 'Бросить на урон', exact: true }).click()
      await expect(dialog).toBeVisible()
      await dialog.getByRole('switch', { name: 'Критическое попадание' }).click()
      await dialog.getByRole('button', { name: 'Бросить на урон', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1))).toEqual({ title: 'Критический урон: Мистический заряд', expression: '2d10{Силовое поле}' })
      expect(await page.evaluate(() => window.writes)).toEqual([])
      expect(await page.evaluate(() => window.casts)).toEqual([])
      await expect(dialog).toHaveCount(0)
      await row.locator('.ad-atk').click()
      const attack = page.getByRole('dialog', { name: 'Мистический заряд · Атака', exact: true })
      await expect(attack).toBeVisible()
      await expect(attack.getByText('После атаки выберите цель и продолжайте броски в хронике сессии.')).toHaveCount(0)
    })
  }
}
