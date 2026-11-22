import { test, expect } from '@playwright/test'
import { installCharacterTransferReference } from './fixtures/character-transfer-reference.js'
import { openSessionPanel, sheetTool } from './fixtures/session-menu.js'

for (const width of [475, 834, 1440]) test(`session menu and transfer references at ${width}`, async ({ page }, testInfo) => {
  const mobile = width < 600
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width, height: mobile ? 751 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installCharacterTransferReference(page, { mobile })
  await page.goto('/char/recipient')
  if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
  const header = page.locator('.character-workspace-header')
  const gear = header.getByRole('button', { name: 'Меню персонажа', exact: true })
  await expect(gear).toBeVisible()
  const settings = page.locator('[data-tutorial="character-menu"]')
  if (mobile) {
    await expect(header.getByRole('button', { name: /^(Сессия|Отдых и рассвет)$/ })).toHaveCount(0)
    await gear.click()
    const shortcuts = settings.locator('.sm-shortcuts')
    const buttons = shortcuts.getByRole('button')
    await expect(buttons).toHaveText([/Сессия/, 'Отдых'])
    expect(await settings.evaluate(node => node.firstElementChild.classList.contains('sm-shortcuts'))).toBe(true)
    for (const button of await buttons.all()) {
      const tile = await button.boundingBox(), icon = await button.locator('svg').boundingBox()
      expect(tile.width).toBe(64)
      expect(tile.height).toBe(64)
      expect(icon.y).toBeLessThan(tile.y + tile.height / 2)
    }
    await expect(settings.getByRole('button', { name: /^(Отменить|Повторить) изменение$/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('phone-settings.png') })
  } else {
    const labels = ['Сессия', 'Отдых и рассвет', 'Меню персонажа']
    const boxes = []
    for (const label of labels) {
      const button = header.getByRole('button', { name: label, exact: true })
      await expect(button).toBeVisible()
      boxes.push(await button.boundingBox())
      await expect(button.locator('svg').first()).toHaveAttribute('width', '24')
    }
    for (const [index, box] of boxes.entries()) {
      expect(box.width).toBe(48)
      expect(box.height).toBe(48)
      expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(1)
      if (index) expect(box.x).toBeGreaterThanOrEqual(boxes[index - 1].x + 48)
    }
    await gear.click()
    await expect(settings.getByRole('button', { name: /^(Отменить|Повторить) изменение$/ })).toHaveCount(2)
    await page.keyboard.press('Escape')
  }
  await (await sheetTool(page, 'Отдых и рассвет')).click()
  await page.getByRole('menuitem', { name: 'Короткий отдых', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Короткий отдых', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await (await sheetTool(page, 'Сессия')).click()
  const sessionMenu = page.getByRole('menu', { name: 'Сессия', exact: true })
  await expect(sessionMenu).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')))
  await expect(sessionMenu).toBeVisible()
  await page.keyboard.press('Escape')
  await openSessionPanel(page, 'Игроки')
  const players = page.getByRole('dialog', { name: 'Другие игроки', exact: true })
  await expect(players).toBeVisible()
  await players.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await openSessionPanel(page, 'События')
  const dialog = page.getByRole('dialog', { name: 'События', exact: true })
  const rows = dialog.locator('.transfer-event')
  await expect(rows).toHaveCount(2)
  expect((await dialog.boundingBox()).x).toBeGreaterThanOrEqual(0)
  await expect(rows.first().locator('.transfer-person img')).toBeVisible()
  await expect(rows.first().locator('.transfer-reference img')).toBeVisible()
  await expect(rows.nth(1)).toHaveClass(/base-tile--framed/)
  expect(await rows.nth(1).evaluate(el => getComputedStyle(el, '::before').borderTopWidth)).toBe('1px')
  await rows.first().getByRole('button', { name: 'Верёвка', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const reference = page.getByRole('dialog', { name: 'Верёвка', exact: true })
  await expect(reference).toBeVisible()
  await expect(reference).toContainText('Описание из справочника')
})
