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
  const sources = ['Бросок', 'Владение', 'Сила', 'Магия оружия', 'Точность', 'Благословение']
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources)
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['2', '1', '1', '2'])
  await expect(attack.getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
  await expect(attack.getByRole('img', { name: 'd4: d4', exact: true })).toBeVisible()
  expect(await attack.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await attack.click()
  const menu = page.getByRole('menu', { name: 'Атака', exact: true })
  await expect(menu.locator('.weapon-formula')).toHaveCount(0)
  await menu.getByRole('switch', { name: 'Благословение', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources.slice(0, -1))
  await menu.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source').first()).toHaveText('Преимущество')
  await expect(attack.locator('.weapon-damage__count')).toHaveText(['2×'])
  const advantageColor = await attack.locator('.weapon-damage__group').evaluate(node => getComputedStyle(node).color)
  await menu.getByRole('button', { name: 'Помеха', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source').first()).toHaveText('Помеха')
  await expect.poll(() => attack.locator('.weapon-damage__group').evaluate(node => getComputedStyle(node).color)).not.toBe(advantageColor)
  await page.keyboard.press('Escape')
  await expect(attack.locator('.weapon-damage__source')).toHaveText(sources)
  await expect(attack.locator('.weapon-damage__count')).toHaveCount(0)
  await card.screenshot({ path: testInfo.outputPath('attack-formula.png') })
  const presets = page.locator('.pac-card')
  await expect(presets).toHaveCount(2)
  for (const [index, preset] of (await presets.all()).entries()) {
    await expect(preset.locator('.weapon-metrics__attack').getByRole('img', { name: 'd20: d20', exact: true })).toBeVisible()
    const labels = await preset.locator('.weapon-metrics__attack .weapon-damage__source').allTextContents()
    expect(labels.slice(0, 2)).toEqual(['Бросок', index === 0 ? 'Владение' : 'Сила'])
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
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Сила'])
  await expect(attack.locator('.weapon-damage__operator')).toHaveText(['−'])
  await expect(attack.locator('.weapon-damage__flat')).toHaveText(['2'])
})

for (const reduced of [false, true]) test(`formula terms animate and recover after quick changes (reduced=${reduced})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.setViewportSize({ width: 704, height: 1100 })
  const api = await weaponSheetFixture(page)
  api.catalogue[205] = { id: 205, typeId: 5, name: 'Благословение', data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack'] }] } }
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const attack = page.locator('.w-card:visible').first().locator('.weapon-metrics__attack')
  await attack.click()
  const toggle = page.getByRole('switch', { name: 'Благословение', exact: true })
  const animatesWidth = await toggle.evaluate(async node => {
    node.click()
    await new Promise(requestAnimationFrame)
    return document.querySelector('.w-card .weapon-metrics__attack').getAnimations({ subtree: true })
      .some(animation => animation.effect?.getKeyframes().some(frame => frame.width))
  })
  expect(animatesWidth).toBe(!reduced)
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила'])
  await toggle.evaluate(async node => {
    for (let i = 0; i < 3; i++) { node.click(); await new Promise(requestAnimationFrame) }
  })
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила', 'Благословение'])
  await page.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила', 'Благословение'])
  await expect(attack.locator('.weapon-damage__count')).toHaveCount(0)
  await expect.poll(() => attack.evaluate(node => node.getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getKeyframes().some(frame => frame.width)).length)).toBe(0)
  expect(await attack.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  expect(api.writes).toEqual([])
})
