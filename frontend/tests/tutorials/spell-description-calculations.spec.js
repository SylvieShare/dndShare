import { test, expect } from '@playwright/test'

async function openDescription(page, name) {
  const row = page.locator('.spell-row').filter({ has: page.locator('.sp-name', { hasText: new RegExp(`^${name}$`) }) })
  await row.click()
  await page.getByRole('menuitem', { name: 'Открыть описание', exact: true }).click()
  return page.getByRole('dialog').last()
}

for (const mobile of [false, true]) {
  test.describe(`spell calculations ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.beforeEach(async ({ page }) => {
      page.on('pageerror', error => { throw error })
      await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { keysets: { common: {} }, types: [], items: [] } }))
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
      await page.goto('/tests/tutorials/fixtures/spell-description-calculations.html')
      await expect(page.locator('.spell-row')).toHaveCount(2)
    })
    test('shows an adjacent live result including zero and negative modifiers without spending slots', async ({ page }) => {
      const dialog = await openDescription(page, 'Героизм')
      const block = dialog.locator('.rich-calculation')
      await expect(block).toContainText('Временные хиты')
      await expect(block).toContainText('Интеллект')
      await expect(block.locator('strong')).toHaveText('3')
      expect(await block.evaluate(element => element.parentElement.previousSibling.textContent)).toContain('равные модификатору')
      await page.evaluate(() => { window.spellCtx.var.stats[4] = 0 })
      await expect(block.locator('strong')).toHaveText('0')
      await page.evaluate(() => { window.spellCtx.var.stats[4] = -2 })
      await expect(block.locator('strong')).toHaveText('-2')
      const overflow = await block.evaluate(element => element.getBoundingClientRect().right > element.closest('[role="dialog"]').getBoundingClientRect().right)
      expect(overflow).toBe(false)
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })
    test('uses the spell tab and innate source, and withholds an unconfigured modifier', async ({ page }) => {
      await page.getByRole('button', { name: 'Бард', exact: true }).click()
      let dialog = await openDescription(page, 'Героизм')
      await expect(dialog.locator('.rich-calculation')).toContainText('Харизма')
      await expect(dialog.locator('.rich-calculation-result')).toHaveText('1')
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
      dialog = await openDescription(page, 'Врождённый героизм')
      await expect(dialog.locator('.rich-calculation-result')).toHaveText('1')
      await page.evaluate(() => { delete window.spellCtx.var.stats[6] })
      await expect(dialog.locator('.rich-calculation-result')).toHaveCount(0)
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })
    test('does not pass the opened spell context into a nested handbook window', async ({ page }) => {
      const dialog = await openDescription(page, 'Героизм')
      await dialog.getByRole('button', { name: /Другое заклинание/ }).click()
      const nested = page.getByRole('dialog').last()
      await expect(nested.locator('.rich-calculation')).toContainText('Модификатор заклинательной характеристики')
      await expect(nested.locator('.rich-calculation-result')).toHaveCount(0)
    })
    test('edits and removes a calculation atom through the description editor', async ({ page }) => {
      await page.locator('.desc-editor [data-rich-node="calculation"]').click()
      await page.getByRole('button', { name: 'Изменить', exact: true }).click()
      const dialog = page.getByRole('dialog').last()
      await dialog.getByLabel('Формула', { exact: true }).fill('max(1, casting_mod)')
      await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
      await expect(page.locator('.desc-editor [data-rich-node="calculation"]')).toContainText('макс(1,')
      expect(await page.evaluate(() => decodeURIComponent(window.descriptionEditor.value))).toContain('max(1, casting_mod)')
      await page.locator('.desc-editor [data-rich-node="calculation"]').click()
      await page.getByRole('button', { name: 'Удалить', exact: true }).click()
      await expect(page.locator('.desc-editor [data-rich-node="calculation"]')).toHaveCount(0)
      expect(await page.evaluate(() => window.descriptionEditor.value)).not.toContain('data-rich-node="calculation"')
      if (mobile) {
        await page.getByRole('button', { name: 'Вставить элемент', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Расчёт', exact: true }).click()
      } else {
        await page.getByRole('button', { name: 'Вставить расчёт', exact: true }).click()
      }
      const insert = page.getByRole('dialog').last()
      await insert.getByLabel('Формула', { exact: true }).fill('2 * prof_bonus')
      await insert.getByRole('button', { name: 'Вставить', exact: true }).click()
      await expect(page.locator('.desc-editor [data-rich-node="calculation"]')).toHaveCount(1)
      expect(await page.evaluate(() => decodeURIComponent(window.descriptionEditor.value))).toContain('2 * prof_bonus')
    })
  })
}
