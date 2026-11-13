import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

test.use({ hasTouch: true })

async function openWeapons(page, width, configure) {
  await page.setViewportSize({ width, height: 1100 })
  const api = await weaponSheetFixture(page)
  configure?.(api)
  await page.goto('/char/test?tab=weapon')
  await page.getByRole('button', { name: 'Оружие', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Оружие', exact: true })).toHaveAttribute('aria-current', 'page')
  const weapon = page.locator('.w-card:visible').first()
  await expect(weapon).toContainText('Тестовое копьё')
  return { api, weapon }
}

for (const width of [390, 834, 1440]) test(`damage keeps its menu sources and shared type at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const { weapon } = await openWeapons(page, width)
  const damage = weapon.locator('.weapon-metrics__damage')
  await expect(damage.locator('.weapon-damage__source')).toHaveText(['Оружие', 'Сила', 'Ярость'])
  await expect(damage.locator('.weapon-damage__flat')).toHaveText(['1', '2'])
  await expect(damage.locator('.weapon-damage__type')).toHaveText(['Колющий'])
  await expect(damage.locator('.weapon-damage__flat').first()).toHaveCSS('font-size', '28px')
  expect(await damage.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await damage.click()
  const menu = page.getByRole('menu', { name: 'Урон', exact: true })
  await expect(menu).toBeVisible()
  await expect(menu.locator('.weapon-formula')).toHaveCount(0)
  await menu.getByRole('switch', { name: 'Критическое попадание', exact: true }).click()
  await expect(damage.locator('.weapon-damage__count')).toHaveText(['2×'])
  await menu.getByRole('switch', { name: 'Двумя руками', exact: true }).click()
  await expect(damage.getByRole('img', { name: 'd8: 8', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(damage.locator('.weapon-damage__count')).toHaveCount(0)
  await expect(damage.getByRole('img')).toHaveCount(2)
  await damage.evaluate(node => node.blur())
  await weapon.screenshot({ path: testInfo.outputPath('damage-sources.png') })
  expect(errors).toEqual([])
})

test('a fixed weapon hit is not lost when its ability modifier is zero', async ({ page }) => {
  const { weapon } = await openWeapons(page, 390, api => {
    api.document().values.STR.value.base = 10
    api.document().values.abilities_class = []
    api.catalogue[201].data.attacks = [{ count: 1, type: 1 }]
    api.catalogue[201].data.universe_attacks = []
  })
  const damage = weapon.locator('.weapon-metrics__damage')
  await expect(damage.locator('.weapon-damage__source')).toHaveText(['Оружие'])
  await expect(damage.locator('.weapon-damage__flat')).toHaveText(['1'])
  await expect(damage.locator('.weapon-damage__type')).toHaveText(['Колющий'])
})

async function touchSwipe(page, origin, distance) {
  const rect = await origin.boundingBox(), start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  for (const step of [.25, .55, 1]) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + distance * step, y: start.y }] })
    await page.evaluate(() => new Promise(requestAnimationFrame))
  }
  const dragging = await page.locator('.mobile-swipe-stage').evaluate(node => node.classList.contains('dragging'))
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  return dragging
}

for (const width of [390, 834]) for (const scope of ['attack', 'damage']) test(`touch on ${scope} taps its menu and swipes tabs at ${width}`, async ({ page }) => {
  const { api, weapon } = await openWeapons(page, width)
  const cell = weapon.locator('.weapon-metrics__' + scope)
  const box = await cell.boundingBox()
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByRole('menu', { name: scope === 'attack' ? 'Атака' : 'Урон', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await touchSwipe(page, cell.locator('.system-die').first(), 24)).toBe(true)
  await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  await expect(page.getByRole('menu')).toHaveCount(0)
  const afterCancel = await cell.boundingBox()
  await page.touchscreen.tap(afterCancel.x + afterCancel.width / 2, afterCancel.y + afterCancel.height / 2)
  await expect(page.getByRole('menu', { name: scope === 'attack' ? 'Атака' : 'Урон', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await touchSwipe(page, cell, width * .22)
  await expect(page.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes).toEqual([])
})
