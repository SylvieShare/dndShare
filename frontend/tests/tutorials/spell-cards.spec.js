import { expect, test } from '@playwright/test'
import { fixture } from './fixtures/character-layout.js'

for (const width of [320, 390, 834, 1440]) test(`spell cards use two columns and shared combat metrics at ${width}px`, async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/spell-rolls.html?cards&presentation&covers')
  await expect(page.locator('.spell-row')).toHaveCount(10)
  await page.evaluate(() => document.fonts.ready)
  for (const group of await page.locator('.spells-level-list').all()) {
    const cards = group.locator('.spell-row')
    if (await cards.count() < 2) continue
    const first = await cards.nth(0).boundingBox(), second = await cards.nth(1).boundingBox()
    expect(Math.abs(first.y - second.y)).toBeLessThan(2)
    expect(second.x).toBeGreaterThan(first.x + first.width)
    expect(first.width).toBeCloseTo(second.width, 0)
  }
  const weapon = page.locator('.spell-row').filter({ hasText: 'Божественное оружие' })
  const russian = await weapon.locator('.sp-name').boundingBox(), english = await weapon.locator('.sp-name-en').boundingBox()
  expect(english.y).toBeGreaterThanOrEqual(russian.y + russian.height)
  const healing = page.locator('.spell-row').filter({ hasText: 'Cure Wounds' })
  await expect(healing.locator('[data-metric-kind=healing] svg')).toHaveClass(/heart-plus/)
  await expect(healing.locator('.weapon-damage .system-die')).toHaveCount(1)
  const attacking = page.locator('.spell-row').filter({ hasText: 'Chill Touch' })
  const attackBox = await attacking.getByRole('button', { name: 'Настроить бросок атаки', exact: true }).boundingBox()
  const damageBox = await attacking.getByRole('button', { name: 'Настроить бросок урона', exact: true }).boundingBox()
  expect(damageBox.y).toBeGreaterThanOrEqual(attackBox.y + attackBox.height)
  expect(damageBox.x).toBeCloseTo(attackBox.x, 0)
  expect(damageBox.width).toBeCloseTo(attackBox.width, 0)
  if (width >= 834) {
    const base = await healing.locator('.weapon-damage').boundingBox(), scaling = await healing.locator('.spell-scaling').boundingBox()
    expect(Math.abs(base.y - scaling.y)).toBeLessThan(2)
    expect(scaling.x).toBeGreaterThanOrEqual(base.x + base.width)
  }
  const temporary = page.locator('.spell-row').filter({ hasText: 'False Life' })
  await expect(temporary.locator('[data-metric-kind=temporary_hp] svg')).toHaveClass(/shield-plus/)
  await expect(page.locator('.spell-row').filter({ hasText: 'Sleep' }).getByRole('button', { name: 'Настроить: Запас хитов' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  for (const card of await page.locator('.spell-row').all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    for (const metric of await card.locator('.combat-metric').all()) {
      expect(await metric.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
  }
  await page.screenshot({ path: info.outputPath('spell-cards.png'), fullPage: true })
})

for (const width of [390, 834, 1440]) test(`spell cards fit the full character sheet at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], cursor: 'test', hasMore: false } }))
  const spells = [
    { id: 551, typeId: 5, name: 'Мистический заряд', nameEn: 'Eldritch Blast', data: { lvl: 0, damage: { range_attack: true, dices: [{ dice_id: 'd10', count: 1 }] } } },
    { id: 552, typeId: 5, name: 'Луч холода', nameEn: 'Ray of Frost', data: { lvl: 0, damage: { range_attack: true, dices: [{ dice_id: 'd8', count: 1 }] } } },
    { id: 553, typeId: 5, name: 'Лечение ран', nameEn: 'Cure Wounds', data: { lvl: 1, heal: { apply: false, add_mod: true, dices: [{ dice_id: 'd8', count: 1 }] } } },
    { id: 554, typeId: 5, name: 'Ложная жизнь', nameEn: 'False Life', data: { lvl: 1, heal: { kind: 'temporary_hp', dices: [{ dice_id: 'd4', count: 1, bonus: 4 }] } } },
  ]
  for (const spell of spells) {
    spell.coverImageUrl = '/tests/tutorials/fixtures/spell-covers/default.webp'
    Object.assign(spell.data, { time: { kind: 'action' }, range: { kind: 'ranged', distance: 60 }, components: { v: true, s: true } })
  }
  api.document().values.spells = { schema_version: 2, slot_pools: { long_rest: [{ level: 1, total: 3, used: 0 }], short_rest: [] },
    tabs: [{ key: 'book', name: 'Волшебник', mode: 'known', casting_ability: 4, spells: spells.map(spell => ({ key: `s:${spell.id}`, id: spell.id })) }], grants: [] }
  await page.route('**/api/items/by-ids?**', route => route.fulfill({ json: { items: new URL(route.request().url()).searchParams.get('ids').split(',').map(Number).map(id => spells.find(spell => spell.id === id)).filter(Boolean) } }))
  await page.goto('/char/test?tab=spells', { waitUntil: 'networkidle' })
  const cards = page.locator('.spell-row:visible')
  await expect(cards).toHaveCount(4)
  await cards.first().scrollIntoViewIfNeeded()
  const a = await cards.nth(0).boundingBox(), b = await cards.nth(1).boundingBox()
  expect(Math.abs(a.y - b.y)).toBeLessThan(2)
  expect(b.x).toBeGreaterThan(a.x + a.width)
  for (const card of await cards.all()) expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await expect(page.getByText('Требуется обновление', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('full-sheet-spell-cards.png') })
})
