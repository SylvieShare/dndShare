import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

for (const width of [390, 704, 1440]) test(`attack preview colors only the base dice at ${width}`, async ({ page }, testInfo) => {
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
  const flatColors = await attack.locator('.weapon-damage__flat').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color))
  const bonusColor = await attack.getByRole('img', { name: 'd4: d4', exact: true }).evaluate(node => getComputedStyle(node).color)
  const baseDice = attack.locator('[data-formula-roll] .system-die')
  await menu.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source').first()).toHaveText('Преимущество')
  await expect(attack.locator('.weapon-damage__count')).toHaveText(['2×'])
  const advantageColor = await baseDice.evaluate(node => getComputedStyle(node).color)
  expect(advantageColor).not.toBe(bonusColor)
  expect(await attack.getByRole('img', { name: 'd4: d4', exact: true }).evaluate(node => getComputedStyle(node).color)).toBe(bonusColor)
  expect(await attack.locator('.weapon-damage__flat').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color))).toEqual(flatColors)
  await menu.getByRole('switch', { name: 'Благословение', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Преимущество', ...sources.slice(1, -1)])
  await menu.getByRole('button', { name: 'Помеха', exact: true }).click()
  await expect(attack.locator('.weapon-damage__source').first()).toHaveText('Помеха')
  await expect.poll(() => baseDice.evaluate(node => getComputedStyle(node).color)).not.toBe(advantageColor)
  expect(await attack.locator('.weapon-damage__flat').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color))).toEqual(flatColors)
  await menu.getByRole('switch', { name: 'Благословение', exact: true }).click()
  expect(await attack.getByRole('img', { name: 'd4: d4', exact: true }).evaluate(node => getComputedStyle(node).color)).toBe(bonusColor)
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

for (const reduced of [false, true]) test(`formula updates immediately and flashes only changed places (reduced=${reduced})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.setViewportSize({ width: 704, height: 1100 })
  const api = await weaponSheetFixture(page)
  api.catalogue[205] = { id: 205, typeId: 5, name: 'Благословение', data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack'] }] } }
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const attack = page.locator('.w-card:visible').first().locator('.weapon-metrics__attack')
  await attack.click()
  const toggle = page.getByRole('switch', { name: 'Благословение', exact: true })
  const update = await toggle.evaluate(async node => {
    node.click()
    await new Promise(requestAnimationFrame)
    const cell = document.querySelector('.w-card .weapon-metrics__attack')
    return { labels: [...cell.querySelectorAll('.weapon-damage__source')].map(node => node.textContent),
      flashes: [...cell.querySelectorAll('[data-formula-flash]')].map(node => node.dataset.formulaFlash),
      changesWidth: cell.getAnimations({ subtree: true }).some(animation => animation.effect?.getKeyframes().some(frame => frame.width)) }
  })
  expect(update.labels).toEqual(['Бросок', 'Владение', 'Сила'])
  expect(update.changesWidth).toBe(false)
  expect(update.flashes).toHaveLength(reduced ? 0 : 1)
  if (!reduced) expect(update.flashes[0]).toContain('Благословение')
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила'])
  await toggle.evaluate(async node => {
    for (let i = 0; i < 3; i++) { node.click(); await new Promise(requestAnimationFrame) }
  })
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила', 'Благословение'])
  await page.getByRole('button', { name: 'Преимущество', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(attack.locator('.weapon-damage__source')).toHaveText(['Бросок', 'Владение', 'Сила', 'Благословение'])
  await expect(attack.locator('.weapon-damage__count')).toHaveCount(0)
  await expect(attack.locator('[data-formula-flash]')).toHaveCount(0)
  const damage = page.locator('.w-card:visible').first().locator('.weapon-metrics__damage').first()
  await damage.click()
  const critical = await page.getByRole('switch', { name: 'Критическое попадание', exact: true }).evaluate(async node => {
    node.click(); await new Promise(requestAnimationFrame)
    const cell = document.querySelector('.w-card .weapon-metrics__damage')
    return { counts: [...cell.querySelectorAll('.weapon-damage__count')].map(node => node.textContent),
      flashes: [...cell.querySelectorAll('[data-formula-flash]')].map(node => node.dataset.formulaFlash) }
  })
  expect(critical.counts).toEqual(['2×'])
  expect(critical.flashes).toHaveLength(reduced ? 0 : 1)
  if (!reduced) expect(critical.flashes[0]).toContain('Оружие')
  await page.keyboard.press('Escape')
  await expect(damage.locator('.weapon-damage__count')).toHaveCount(0)
  expect(await attack.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  expect(api.writes).toEqual([])
})
