import { test, expect } from '@playwright/test'
import { weaponSheetFixture } from './fixtures/weapon-sheet'

const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M12 52 49 8l5 4-35 45z" fill="#ae8ee8"/></svg>')
async function openWeapons(page, width, owner = true) {
  await page.setViewportSize({ width, height: 1100 })
  const api = await weaponSheetFixture(page, owner)
  const ids = [201, 211, 212]
  for (const [index, name] of ['Копьё', 'Длинный меч', 'Лук'].entries()) api.catalogue[ids[index]] = {
    ...api.catalogue[201], id: ids[index], name, iconImageUrl: image,
  }
  api.document().values.weapon = ['first', 'second', 'third'].map((uid, index) => ({ uid, item_id: ids[index] }))
  await page.goto('/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const grid = page.locator('[data-sortable-container="weapons"]:visible')
  await expect(grid.locator('.w-card')).toHaveCount(3)
  await expect(grid.locator('.w-name').first()).toHaveText('Копьё')
  return { api, grid }
}

for (const width of [390, 834, 1440, 1920]) test(`weapon and basic-attack cards share their layout at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const { grid } = await openWeapons(page, width)
  const block = grid.locator('xpath=ancestor::div[contains(@class,"weapons-block")]')
  const basics = block.getByRole('region', { name: 'Базовые атаки' })
  await expect(basics.locator('.share-section-label__line')).toBeVisible()
  await expect(basics.locator('.pac-card')).toHaveCount(2)
  await expect(block.locator('.w-table')).toHaveCount(0)
  const gridWidth = (await grid.boundingBox()).width
  const columns = Math.min(2, Math.max(1, Math.floor((gridWidth + 12) / (280 + 12))))
  for (const [container, selector] of [[grid, '.w-card'], [basics.locator('.weapon-card-grid'), '.pac-card']]) {
    const positions = await container.locator(selector).evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().x)))
    expect(new Set(positions).size).toBe(columns)
    for (const card of await container.locator(selector).all()) {
      const icon = await card.locator('.weapon-card-layout__icon').boundingBox()
      const heading = await card.locator('.weapon-card-layout__heading').boundingBox()
      const controls = await card.locator('.weapon-card-layout__controls').boundingBox()
      expect(Math.round(icon.width)).toBe(64)
      expect(heading.x).toBeGreaterThan(icon.x + icon.width)
      expect(controls.y).toBeGreaterThanOrEqual(Math.max(icon.y + icon.height, heading.y + heading.height))
      expect(controls.x).toBeLessThan(heading.x)
      expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
  }
  if (width === 1920) expect(columns).toBe(2)
  await block.screenshot({ path: testInfo.outputPath('weapon-cards.png'), animations: 'disabled' })
  await basics.locator('.pac-card').first().getByRole('button', { name: 'Настроить бросок атаки', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Атака', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

for (const width of [834, 1920]) test(`held dragging reorders across columns, returns to origin and leaves controls usable at ${width}`, async ({ page }) => {
  const { api, grid } = await openWeapons(page, width)
  const cards = grid.locator('.w-card'), first = cards.nth(0), second = cards.nth(1)
  const start = await first.locator('.w-name').boundingBox(), target = await second.locator('.w-name').boundingBox()
  const x = start.x + 8, y = start.y + 8
  const writes = api.writes.length
  await page.mouse.move(x, y); await page.mouse.down()
  await expect(grid.locator('.sortable-placeholder')).toHaveCount(1)
  await page.mouse.move(target.x + 8, target.y + 8)
  await expect(second).toHaveClass(/w-card--drop-target/)
  await page.mouse.move(x, y); await page.mouse.up()
  expect(api.document().values.weapon.map(weapon => weapon.uid)).toEqual(['first', 'second', 'third'])
  expect(api.writes.length).toBe(writes)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.mouse.down(); await expect(grid.locator('.sortable-placeholder')).toHaveCount(1)
  await page.mouse.move(target.x + 8, target.y + 8); await page.mouse.up()
  await expect.poll(() => api.document().values.weapon.map(weapon => weapon.uid)).toEqual(['second', 'first', 'third'])
  await expect(page.getByRole('menu')).toHaveCount(0)
  const card = grid.locator('.w-card').first()
  await card.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'Действия: Длинный меч' })).toBeVisible()
  await page.keyboard.press('Escape')
  await card.getByRole('button', { name: 'Настроить бросок атаки', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Атака', exact: true })).toBeVisible()
})

test('a held touch reorders tablet weapons while short motion keeps scrolling and tab swipes', async ({ page }) => {
  await page.context().newCDPSession(page).then(client => client.send('Emulation.setTouchEmulationEnabled', { enabled: true }))
  const { api, grid } = await openWeapons(page, 834)
  const client = await page.context().newCDPSession(page)
  const first = await grid.locator('.w-card').nth(0).locator('.w-name').boundingBox()
  const second = await grid.locator('.w-card').nth(1).locator('.w-name').boundingBox()
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x + 8, y: first.y + 8, id: 1 }] })
  await expect(grid.locator('.sortable-placeholder')).toHaveCount(1)
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: second.x + 8, y: second.y + 8, id: 1 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => api.document().values.weapon.map(weapon => weapon.uid)).toEqual(['second', 'first', 'third'])
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('[data-sheet-section="weapons"]:visible')).toBeVisible()
  const source = await grid.locator('.w-card').first().boundingBox()
  const start = { x: source.x + source.width * .8, y: source.y + 35, id: 1 }
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  for (let step = 1; step <= 5; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, x: start.x - step * 52 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByRole('button', { name: 'Магия', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('read-only weapon cards keep viewing and never start a held drag', async ({ page }) => {
  const { api, grid } = await openWeapons(page, 1440, false)
  await page.clock.install()
  const name = await grid.locator('.w-name').first().boundingBox()
  await page.mouse.move(name.x + 8, name.y + 8); await page.mouse.down(); await page.clock.fastForward(500)
  await expect(grid.locator('.sortable-placeholder')).toHaveCount(0)
  await page.mouse.up()
  const menu = page.getByRole('menu', { name: 'Действия: Копьё' })
  await expect(menu.getByRole('menuitem', { name: 'Открыть описание' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Изменить', exact: true })).toHaveCount(0)
  expect(api.writes).toEqual([])
})
