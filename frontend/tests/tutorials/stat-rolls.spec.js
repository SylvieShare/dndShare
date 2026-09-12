import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) {
  test.describe(`stat roll menu ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.beforeEach(async ({ page }) => {
      page.on('pageerror', error => { throw error })
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
      await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
    })

    test('checks, saves and skills require confirmation and preserve bonuses and roll effects', async ({ page }) => {
      const cases = [
        { label: 'Ловкость — проверка', title: 'Ловкость — проверка', bonus: 3, advantage: false, disadvantage: true, mode: 'disadvantage', scope: 'ability_check' },
        { label: 'Ловкость — спасбросок', title: 'Ловкость — спасбросок', bonus: 6, advantage: true, disadvantage: false, mode: 'advantage', scope: 'saving_throw' },
        { label: 'Скрытность — проверка', title: 'Скрытность', bonus: 7, advantage: true, disadvantage: true, mode: 'normal', scope: 'ability_check' },
      ]
      for (const [index, entry] of cases.entries()) {
        await page.getByRole('button', { name: entry.label, exact: true }).click()
        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible()
        expect(await page.evaluate(() => window.rolls.length)).toBe(index)
        const advantage = menu.getByRole('switch', { name: 'Преимущество' })
        const disadvantage = menu.getByRole('switch', { name: 'Помеха' })
        await expect(advantage).toHaveAttribute('aria-checked', String(entry.advantage))
        await expect(disadvantage).toHaveAttribute('aria-checked', String(entry.disadvantage))
        const a = await advantage.boundingBox(), d = await disadvantage.boundingBox()
        expect(Math.abs(a.y - d.y)).toBeLessThan(2)
        const bounds = await menu.boundingBox()
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(mobile ? 390 : 1400)
        await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
        await expect(menu).toHaveCount(0)
        const roll = await page.evaluate(() => window.rolls.at(-1))
        expect(roll).toMatchObject({ title: entry.title, bonus: entry.bonus, mode: entry.mode,
          options: { color: 'var(--accent)', crit_mode: true, roll_triggers: [{ scope: entry.scope }] } })
        expect(roll.options.roll_adjustments).toEqual([entry.title === 'Скрытность'
          ? { scope: entry.scope, proficiencyRank: 2 } : { scope: entry.scope }])
      }
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })

    test('temporary overrides reset on reopen and use fresh sheet defaults', async ({ page }) => {
      const trigger = page.getByRole('button', { name: 'Ловкость — проверка', exact: true })
      const menu = page.getByRole('menu')
      await trigger.focus()
      await page.keyboard.press('Enter')
      await menu.getByRole('switch', { name: 'Помеха' }).click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).mode)).toBe('normal')
      await trigger.click()
      await expect(menu.getByRole('switch', { name: 'Помеха' })).toHaveAttribute('aria-checked', 'true')
      await menu.getByRole('switch', { name: 'Преимущество' }).click()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.checkEffects = [{ mode: 'advantage' }] })
      await trigger.click()
      await expect(menu.getByRole('switch', { name: 'Преимущество' })).toHaveAttribute('aria-checked', 'true')
      await expect(menu.getByRole('switch', { name: 'Помеха' })).toHaveAttribute('aria-checked', 'false')
      await page.mouse.click(5, 5)
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.value.check_roll_mode = 'normal' })
      await trigger.click()
      await expect(menu.getByRole('switch', { name: 'Преимущество' })).toHaveAttribute('aria-checked', 'false')
      await expect(menu.getByRole('switch', { name: 'Помеха' })).toHaveAttribute('aria-checked', 'false')
      await menu.getByRole('switch', { name: 'Преимущество' }).click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.map(roll => roll.mode))).toEqual(['normal', 'advantage'])
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })
  })
}
