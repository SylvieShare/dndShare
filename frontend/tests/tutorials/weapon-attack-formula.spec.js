import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

for (const width of [390, 704, 1440]) test(`attack-window preview colors only the base dice at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1100 })
  const api = await weaponSheetFixture(page)
  api.document().values.weapon[0].params = { magic_bonus: 1 }
  api.catalogue[205] = { id: 205, typeId: 5, name: 'Благословение', data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack'] }] } }
  api.catalogue[207] = { id: 207, typeId: 5, name: 'Точность', data: { derived_effects: [{ kind: 'weapon_attack_bonus', value: 2 }] } }
  api.document().values.abilities_class.push({ id: 207 })
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const card = page.locator('.w-card:visible').first(), attack = card.locator('.weapon-metrics__attack')
  const sources = ['Бросок', 'Владение', 'Сила', 'Магия оружия', 'Точность', 'Благословение']
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources.slice(1))
  await expect(attack.getByRole('img', { name: 'd20: d20', exact: true })).toHaveCount(0)
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['2', '1', '1', '2'])
  await attack.click()
  const dialog = page.getByRole('dialog', { name: /· Атака$/ }), preview = dialog.locator('.weapon-roll-preview')
  await expect(dialog.getByRole('group', { name: 'Дополнительные эффекты', exact: true })).toBeVisible()
  await dialog.screenshot({ path: testInfo.outputPath('attack-options.png'), animations: 'disabled' })
  await expect(preview.locator('.weapon-damage__source')).toHaveText(sources)
  await expect(preview.getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
  const flatColors = await preview.locator('.weapon-damage__flat').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color))
  const bonusColor = await preview.getByRole('img', { name: 'd4: d4', exact: true }).evaluate(node => getComputedStyle(node).color)
  await dialog.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await expect(preview.locator('.weapon-damage__source').first()).toHaveText('Преимущество')
  await expect(preview.locator('.weapon-damage__count')).toHaveText(['2×'])
  const advantageColor = await preview.locator('[data-formula-roll] .system-die').evaluate(node => getComputedStyle(node).color)
  expect(advantageColor).not.toBe(bonusColor)
  expect(await preview.getByRole('img', { name: 'd4: d4', exact: true }).evaluate(node => getComputedStyle(node).color)).toBe(bonusColor)
  expect(await preview.locator('.weapon-damage__flat').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color))).toEqual(flatColors)
  await dialog.getByRole('button', { name: 'Благословение', exact: true }).click()
  await expect(preview.getByRole('img', { name: 'd4: d4', exact: true })).toHaveCount(0)
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources.slice(1))
  await expect(attack.getByRole('img', { name: 'd4: d4', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(attack.locator('.weapon-damage__count')).toHaveCount(0)
  await card.screenshot({ path: testInfo.outputPath('attack-formula.png'), animations: 'disabled' })
  const presets = page.locator('.pac-card')
  await expect(presets).toHaveCount(2)
  for (const [index, preset] of (await presets.all()).entries()) {
    const presetAttack = preset.locator('.weapon-metrics__attack')
    await expect(presetAttack.getByRole('img', { name: 'd20: d20', exact: true })).toHaveCount(0)
    const labels = await preset.locator('.weapon-metrics__attack .weapon-damage__source').allTextContents()
    expect(labels[0]).toBe(index === 0 ? 'Владение' : 'Сила')
    await presetAttack.click()
    const presetDialog = page.getByRole('dialog', { name: /· Атака$/ })
    await expect(presetDialog.getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(presetDialog).toHaveCount(0)
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
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Сила'])
  await expect(attack.locator('.weapon-damage__operator')).toHaveText(['−'])
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['2'])
})

for (const reduced of [false, true]) test(`window formula flashes changed sources without changing the card (reduced=${reduced})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.setViewportSize({ width: 704, height: 1100 })
  const api = await weaponSheetFixture(page)
  api.catalogue[205] = { id: 205, typeId: 5, name: 'Благословение', data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack'] }] } }
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const card = page.locator('.w-card:visible').first(), attack = card.locator('.weapon-metrics__attack')
  await attack.click()
  const dialog = page.getByRole('dialog', { name: /· Атака$/ }), preview = dialog.locator('.weapon-roll-preview')
  const update = await dialog.getByRole('button', { name: 'Благословение', exact: true }).evaluate(async node => {
    node.click(); await new Promise(requestAnimationFrame)
    const formula = document.querySelector('.weapon-roll-preview')
    return { labels: [...formula.querySelectorAll('.weapon-damage__source')].map(node => node.textContent),
      flashes: [...formula.querySelectorAll('[data-formula-flash]')].map(node => node.dataset.formulaFlash),
      widthAnimation: formula.getAnimations({ subtree: true }).some(animation => animation.effect?.getKeyframes().some(frame => frame.width)) }
  })
  expect(update.labels).toEqual(['Бросок', 'Владение', 'Сила'])
  expect(update.widthAnimation).toBe(false)
  expect(update.flashes).toHaveLength(reduced ? 0 : 1)
  if (!reduced) expect(update.flashes[0]).toContain('Благословение')
  await expect(preview.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила'])
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Владение', 'Сила', 'Благословение'])
  await expect(attack.locator('[data-formula-flash]')).toHaveCount(0)
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  const damage = card.locator('.weapon-metrics__damage').first()
  await damage.click()
  const damageDialog = page.getByRole('dialog', { name: /· Урон$/ })
  await damageDialog.getByRole('button', { name: 'Критическое попадание', exact: true }).click()
  await expect(damageDialog.locator('.weapon-roll-preview .weapon-damage__count')).toHaveText(['2×'])
  await expect(damage.locator('.weapon-damage__count')).toHaveCount(0)
  await expect(damage.locator('[data-formula-flash]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(api.writes).toEqual([])
})
