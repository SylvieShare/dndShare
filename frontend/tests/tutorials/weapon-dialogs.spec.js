import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

async function open(page, width) {
  await page.setViewportSize({ width, height: 1000 })
  const api = await weaponSheetFixture(page)
  api.catalogue[201].data.properties = [1]
  api.suggests[14] = [{ id: 1, value: 'Универсальное', desc: 'Можно использовать двумя руками.' }]
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const card = page.locator('.w-card:visible').first()
  await expect(card.locator('.w-name')).toHaveText('Тестовое копьё')
  return { api, card }
}

for (const width of [390, 834, 1440]) test(`grip labels and roll windows keep the card stable at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const { card, api } = await open(page, width)
  await expect(card.locator('.weapon-metrics__grip')).toHaveCount(0)
  await expect(card.locator('.weapon-metrics__properties > .weapon-metrics__label')).toHaveCount(0)
  const damage = card.locator('.weapon-metrics__damage').first()
  await expect(damage.locator('.weapon-grip')).toHaveCount(2)
  await expect(damage.locator('.weapon-grip').nth(0)).toHaveAttribute('aria-label', 'Одной рукой')
  await expect(damage.locator('.weapon-grip').nth(1)).toHaveAttribute('aria-label', 'Двумя руками')
  const shared = damage.locator('.weapon-damage__column--grips')
  await expect(shared.locator('.weapon-damage__source')).toHaveText('Оружие')
  const caption = await shared.locator('.weapon-damage__source').boundingBox()
  const formula = await shared.locator('.weapon-damage__formula').boundingBox()
  expect(Math.abs(caption.x + caption.width / 2 - formula.x - formula.width / 2)).toBeLessThan(1)
  await damage.click()
  const dialog = page.getByRole('dialog', { name: 'Тестовое копьё · Урон', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('menu')).toHaveCount(0)
  const preview = dialog.locator('.weapon-roll-preview')
  await dialog.getByRole('switch', { name: 'Критическое попадание', exact: true }).click()
  await expect(preview.locator('.weapon-damage__count')).toHaveText(['2×'])
  await expect(damage.locator('.weapon-damage__count')).toHaveCount(0)
  await dialog.getByRole('switch', { name: 'Двумя руками', exact: true }).click()
  await expect(preview.getByRole('img', { name: 'd8: 8', exact: true })).toBeVisible()
  await dialog.screenshot({ path: testInfo.outputPath('damage-window.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(damage.locator('.weapon-grip')).toHaveCount(2)
  const attack = card.locator('.weapon-metrics__attack')
  await attack.click()
  const attackWindow = page.getByRole('dialog', { name: 'Тестовое копьё · Атака', exact: true })
  await attackWindow.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await expect(attackWindow.locator('.weapon-roll-preview .weapon-damage__count')).toHaveText(['2×'])
  await expect(attack.locator('.weapon-damage__count')).toHaveCount(0)
  await expect(attackWindow.getByRole('button', { name: 'Бросить на атаку', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})

test('collapse is view-only, ignores action-menu clicks and follows the instance across responsive remounts', async ({ page }) => {
  const { card, api } = await open(page, 390)
  const expanded = (await card.boundingBox()).height
  await card.getByRole('button', { name: 'Свернуть Тестовое копьё', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Развернуть Тестовое копьё', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await card.boundingBox()).height).toBeLessThan(expanded - 60)
  await expect(card.getByRole('button', { name: 'Настроить бросок атаки' })).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.setViewportSize({ width: 834, height: 1000 })
  const tabletCard = page.locator('.w-card:visible').first()
  await expect(tabletCard.getByRole('button', { name: 'Развернуть Тестовое копьё', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await tabletCard.getByRole('button', { name: 'Развернуть Тестовое копьё', exact: true }).click()
  await expect(tabletCard.getByRole('button', { name: 'Настроить бросок атаки' })).toBeVisible()
  expect(api.writes).toEqual([])
})
