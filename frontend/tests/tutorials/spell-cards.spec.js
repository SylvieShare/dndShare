import { expect, test } from '@playwright/test'
import { layoutTokens } from '../../src/app/design-tokens.js'
import { grantedSpellName, installSpellCardSheet } from './fixtures/character-spell-cards.js'

const minWidth = layoutTokens['spell-card-min-width']
const gap = layoutTokens['spell-card-gap']

async function expectSpellGrid(group) {
  const grid = await group.evaluate(node => ({
    width: node.getBoundingClientRect().width,
    cards: Array.from(node.querySelectorAll('.spell-row'), card => card.getBoundingClientRect().toJSON()),
  }))
  const capacity = Math.max(1, Math.floor((grid.width + gap + 0.01) / (minWidth + gap)))
  const columns = Math.min(grid.cards.length, capacity)
  expect(columns).toBeGreaterThan(0)
  const firstRow = grid.cards.filter(card => Math.abs(card.top - grid.cards[0].top) < 1)
  expect(firstRow).toHaveLength(columns)
  const trackWidth = (grid.width - (columns - 1) * gap) / columns
  for (const card of grid.cards) expect(card.width).toBeCloseTo(trackWidth, 0)
  return columns
}

for (const width of [320, 390, 834, 1440]) test(`spell cards use available columns and shared combat metrics at ${width}px`, async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/spell-rolls.html?cards&presentation&covers')
  await expect(page.locator('.spell-row')).toHaveCount(10)
  await page.evaluate(() => document.fonts.ready)
  const counts = []
  for (const group of await page.locator('.spells-level-list').all()) counts.push(await expectSpellGrid(group))
  expect(Math.max(...counts)).toBe(width < 600 ? 1 : 3)
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
  const base = await healing.locator('.weapon-damage').boundingBox()
  const scaling = await healing.locator('.spell-scaling').boundingBox()
  expect(scaling.x >= base.x + base.width - 1 || scaling.y >= base.y + base.height - 1).toBe(true)
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

for (const width of [320, 475, 834, 1440]) test(`spell cards fit the full character sheet at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 475 ? 751 : 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installSpellCardSheet(page)
  await page.goto('/char/test?tab=spells', { waitUntil: 'networkidle' })
  const cards = page.locator('.spell-row:visible')
  await expect(cards).toHaveCount(5)
  await page.evaluate(() => document.fonts.ready)
  const groups = page.locator('.spells-level-list:visible')
  const counts = []
  for (const group of await groups.all()) counts.push(await expectSpellGrid(group))
  expect(Math.max(...counts)).toBe(width < 600 ? 1 : 2)
  const granted = cards.filter({ hasText: grantedSpellName })
  await expect(granted).toContainText('Дьявольское наследие')
  await expect(granted).toContainText('Hellish Rebuke')
  await expect(granted.locator('[data-metric-kind=damage]')).toBeVisible()
  await granted.scrollIntoViewIfNeeded()
  for (const card of await cards.all()) expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await expect(page.getByText('Требуется обновление', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('full-sheet-spell-cards.png') })
})
