import { test, expect } from '@playwright/test'

for (const width of [390, 834, 1920]) {
  test.describe(`stat roll menu at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      page.on('pageerror', error => { throw error })
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
    })

    test('checks, saves and skills require confirmation and preserve bonuses and roll effects', async ({ page }) => {
      const cases = [
        { label: 'Ловкость — проверка', title: 'Ловкость — проверка', bonus: 3, advantage: false, disadvantage: true, mode: 'disadvantage', scope: 'ability_check' },
        { label: 'Ловкость — спасбросок', title: 'Ловкость — спасбросок', bonus: 6, advantage: true, disadvantage: false, mode: 'advantage', scope: 'saving_throw' },
        { label: 'Скрытность — проверка', title: 'Скрытность', bonus: 7, advantage: false, disadvantage: false, mode: 'normal', scope: 'ability_check' },
      ]
      for (const [index, entry] of cases.entries()) {
        await page.getByRole('button', { name: entry.label, exact: true }).click()
        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible()
        expect(await page.evaluate(() => window.rolls.length)).toBe(index)
        const advantage = menu.getByRole('button', { name: 'Преимущество', exact: true })
        const disadvantage = menu.getByRole('button', { name: 'Помеха', exact: true })
        await expect(advantage).toHaveAttribute('aria-pressed', String(entry.advantage))
        await expect(disadvantage).toHaveAttribute('aria-pressed', String(entry.disadvantage))
        const a = await advantage.boundingBox(), d = await disadvantage.boundingBox()
        expect(Math.abs(a.y - d.y)).toBeLessThan(2)
        const bounds = await menu.boundingBox()
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
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

    test('blessing is enabled for saves and can be omitted for one roll', async ({ page }) => {
      const trigger = page.getByRole('button', { name: 'Ловкость — спасбросок', exact: true })
      await trigger.click()
      await expect(page.getByRole('switch', { name: 'Благословение' })).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('switch', { name: 'Благословение' }).click()
      await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).options.bonus_formula)).toBe('')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await trigger.click()
      await expect(page.getByRole('switch', { name: 'Благословение' })).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).options.bonus_formula)).toBe('1d4')
    })

    test('temporary overrides reset on reopen and use fresh sheet defaults', async ({ page }) => {
      const trigger = page.getByRole('button', { name: 'Ловкость — проверка', exact: true })
      const menu = page.getByRole('menu')
      await trigger.focus()
      await page.keyboard.press('Enter')
      const advantage = menu.getByRole('button', { name: 'Преимущество', exact: true })
      const disadvantage = menu.getByRole('button', { name: 'Помеха', exact: true })
      await disadvantage.click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).mode)).toBe('normal')
      await trigger.click()
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'true')
      await advantage.press('Space')
      await expect(advantage).toHaveAttribute('aria-pressed', 'true')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await disadvantage.click()
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'true')
      await expect(advantage).toHaveAttribute('aria-pressed', 'false')
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.checkEffects = [{ mode: 'advantage' }] })
      await trigger.click()
      await expect(advantage).toHaveAttribute('aria-pressed', 'true')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await page.mouse.click(5, 5)
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.value.check_roll_mode = 'normal' })
      await trigger.click()
      await expect(advantage).toHaveAttribute('aria-pressed', 'false')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await advantage.click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.map(roll => roll.mode))).toEqual(['normal', 'advantage'])
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })
  })
}
