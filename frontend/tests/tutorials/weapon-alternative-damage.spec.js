import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'
import lightningThrow from '../fixtures/mechanics/lightning-throw.json' with { type: 'json' }

async function open(page, { owner = true, remaining = 1 } = {}) {
  await page.setViewportSize({ width: 704, height: 1100 })
  const api = await weaponSheetFixture(page, owner)
  Object.assign(api.document().values.weapon[0], { magic_item_id: 284, params: { magic: { remaining } } })
  api.catalogue[284] = { id: 284, typeId: 19, name: 'Копьё молнии', data: {
    weapon: { base_item_id: 201 }, attunement: 'none', max_use: 1, weapon_uses: [lightningThrow],
  } }
  api.suggests[12].push({ id: 9, typeId: 12, value: 'Молния', color: 'var(--warning)' })
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const card = page.locator('.w-card:visible').first()
  await expect(card.locator('.weapon-metrics__alternative')).toHaveCount(2)
  return { api, card, magic: () => api.document().values.weapon[0].params.magic }
}

test('separate alternative cells preview freely and share the existing one-time use payment', async ({ page }) => {
  const { api, card, magic } = await open(page)
  const line = card.locator('[data-damage-key="lightning_throw:line"]')
  const target = card.locator('[data-damage-key="lightning_throw:target"]')
  await expect(line.locator('.weapon-damage__count')).toHaveText(['4×'])
  await expect(line.locator('.weapon-damage__type')).toHaveText(['Молния'])
  await expect(target.locator('.weapon-damage__source')).toHaveText(['Оружие', 'Сила', 'Ярость', 'Метнуть молнией'])
  expect(magic().remaining).toBe(1)
  expect(api.writes).toEqual([])
  await line.click()
  const menu = page.getByRole('menu', { name: 'Урон', exact: true })
  await expect(menu).toContainText('Сл 13')
  await expect(menu.locator('.weapon-damage,.weapon-formula')).toHaveCount(0)
  await menu.getByRole('menuitem', { name: 'Бросить на урон', exact: true }).click()
  await expect.poll(() => magic().remaining).toBe(0)
  await expect.poll(() => magic().weapon_use.steps.map(step => step.status)).toEqual(['rolled', 'pending'])
  await target.click()
  await menu.getByRole('switch', { name: 'Критическое попадание', exact: true }).click()
  await expect(target.locator('.weapon-damage__count')).toHaveText(['2×', '8×'])
  await menu.getByRole('menuitem', { name: 'Бросить на урон', exact: true }).click()
  await expect.poll(() => magic().weapon_use.steps.map(step => step.status)).toEqual(['rolled', 'rolled'])
  expect(magic().remaining).toBe(0)
  await target.click()
  await expect(menu.getByRole('menuitem', { name: 'Бросить на урон', exact: true })).toBeDisabled()
})

test('a reader sees alternative formulas without editable roll controls or writes', async ({ page }) => {
  const { api, card } = await open(page, { owner: false })
  await expect(card.getByRole('button', { name: /^Настроить урон:/ })).toHaveCount(0)
  await card.locator('.weapon-metrics__alternative').first().click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes).toEqual([])
})

test('insufficient charges keep the alternative formula visible but block spending', async ({ page }) => {
  const { api, card, magic } = await open(page, { remaining: 0 })
  await card.locator('.weapon-metrics__alternative').first().click()
  const menu = page.getByRole('menu', { name: 'Урон', exact: true })
  await expect(menu).toContainText('Недостаточно ресурса')
  await expect(menu.getByRole('menuitem', { name: 'Бросить на урон', exact: true })).toBeDisabled()
  expect(magic().remaining).toBe(0)
  expect(api.writes).toEqual([])
})
