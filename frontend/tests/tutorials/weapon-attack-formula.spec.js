import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

for (const width of [390, 704, 1440]) test(`attack formula matches its roll menu at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1100 })
  const api = await weaponSheetFixture(page)
  api.document().values.weapon[0].params = { magic_bonus: 1 }
  api.catalogue[205] = { id: 205, typeId: 5, name: 'Благословение', data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack'] }] } }
  api.catalogue[207] = { id: 207, typeId: 5, name: 'Точность', data: { derived_effects: [{ kind: 'weapon_attack_bonus', value: 2 }] } }
  api.document().values.abilities_class.push({ id: 207 })
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const card = page.locator('.w-card:visible').first()
  const attack = card.getByRole('button', { name: 'Настроить бросок атаки', exact: true })
  const sources = ['Атака', 'Сила', 'Магия оружия', 'Владение', 'Точность', 'Благословение']
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources)
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['1', '1', '2', '2'])
  await expect(attack.getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
  await expect(attack.getByRole('img', { name: 'd4: d4', exact: true })).toBeVisible()
  expect(await attack.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await attack.click()
  const menu = page.getByRole('menu', { name: 'Атака', exact: true })
  await expect(menu.locator('.weapon-formula-row > small')).toHaveText(sources)
  await page.keyboard.press('Escape')
  await card.screenshot({ path: testInfo.outputPath('attack-formula.png') })
  for (const preset of await page.locator('.pac-card').all()) {
    await expect(preset.locator('.weapon-metrics__attack').getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
  }
  expect(api.writes).toEqual([])
})

test('attack formula preserves a negative ability modifier without proficiency', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  const api = await weaponSheetFixture(page)
  api.document().values.weapon[0].proficient = false
  api.document().values.STR.value.base = 6
  api.document().values.abilities_class = []
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const attack = page.locator('.w-card:visible').first().locator('.weapon-metrics__attack')
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Атака', 'Сила'])
  await expect(attack.locator('.weapon-damage__operator')).toHaveText(['−'])
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['2'])
})
