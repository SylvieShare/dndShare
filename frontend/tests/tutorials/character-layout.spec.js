import { test, expect } from '@playwright/test'
import { applyDocumentPatches } from '../../src/shared/lib/documentPatch.js'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

async function fixture(page, templateName = 'DND5', owner = true) {
  const values = { name: 'Лира', char_name: 'Алекс', hp: { current: 18, max: { base: 23, bonuses: [] }, hitDice: [] },
    lvl: { level: 3, exp: 700 }, prof_bonus: { v: 2, auto: true }, speed: { base: 30, bonuses: [] }, armor: { bonuses: [] },
    initiative: { base: 0, use_dex: true, bonuses: [] }, items: { equipped: [], sections: [] }, states: [], exhaustion: { level: 0 },
    clan: 'Тореадор', strength: 3, dexterity: 2, stamina: 2 }
  for (const [index, stat] of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].entries()) {
    values[stat] = { value: { base: 12 + index, bonuses: [] }, skills: Object.fromEntries(Array.from({ length: [1, 3, 0, 5, 5, 4][index] }, (_, j) => [String(100 + index * 10 + j), { up: 0, override_title: `Навык ${index + 1}.${j + 1}` }])) }
  }
  let document = { values, var: { stats: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 } } }, version = 1
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'PATCH' && path === '/api/char/test/data') {
      const body = route.request().postDataJSON()
      writes.push(body)
      document = applyDocumentPatches(document, body.patches)
      return route.fulfill({ json: { fromVersion: version, version: ++version, mutationId: body.mutationId, patches: body.patches } })
    }
    let json = {}
    if (path === '/api/char/test') json = { templateName, userId: owner ? 1 : 2, sourceVersionId: 1, version, data: document }
    if (path === '/api/account/tutorials') json = { tutorials: ['mobile', 'desktop'].map(device => ({ flowId: 'character', sourceKey: 'edition:1', device, status: 'completed', revision: TUTORIAL_REVISION })) }
    if (path === '/api/suggest/batch') json = { items: { 16: ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'].map((value, i) => ({ id: i + 1, typeId: 16, value })), 15: [] } }
    if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    if (path === '/api/char/test/changes') json = { fromVersion: version, version, patches: [] }
    await route.fulfill({ json })
  })
  return { writes, document: () => document }
}

for (const width of [600, 834, 1100]) test(`tablet sheet uses its own base and balanced stats at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const nav = page.getByRole('navigation', { name: 'Раздел персонажа' })
  await expect(nav.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.dnd-tablet-base')).toBeVisible()
  await expect(page.locator('[data-tutorial="character-hp"]')).toBeVisible()
  await nav.getByRole('button', { name: 'Статы', exact: true }).click()
  await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  const stats = page.locator('.dnd-stats:visible')
  await expect(stats.locator('[data-sheet-field]')).toHaveCount(6)
  const columns = await stats.locator('[data-sheet-field]').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().x))).size)
  expect(columns).toBe(width === 600 ? 1 : width === 834 ? 2 : 3)
  const boxes = await stats.locator('[data-sheet-field]').evaluateAll(nodes => nodes.map(node => ({ x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right })))
  const outer = await stats.boundingBox()
  expect(Math.min(...boxes.map(box => box.x))).toBeCloseTo(outer.x, 0)
  expect(Math.max(...boxes.map(box => box.right))).toBeCloseTo(outer.x + outer.width, 0)
  await nav.getByRole('button', { name: 'Магия', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.tutorialRoute())).toContain('tab=spells')
  await page.evaluate(() => window.characterHistoryBack())
  await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})

test('fold resizing retains semantic sections and editable character data', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Магия', exact: true }).click()
  for (const width of [390, 1100, 1440, 834]) {
    await page.setViewportSize({ width, height: 1100 })
    await expect(page.locator('[data-sheet-section="spells"]:visible')).toHaveCount(1)
  }
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Статы', exact: true }).click()
  await page.getByRole('button', { name: 'Редактировать: Сила', exact: true }).click()
  await expect(page.locator('.mes-editor:visible')).toBeVisible()
  expect(api.document().values.hp.current).toBe(18)
  expect(api.writes).toEqual([])
})

for (const width of [390, 834, 1440]) test(`VTM uses native composition at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  await fixture(page, 'VTM20')
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.getByText('Алекс', { exact: true }).first()).toBeVisible()
  await expect.poll(() => page.locator('[data-sheet-field="clan"]:visible').evaluate(node => node.textContent.includes('Тореадор') || [...node.querySelectorAll('input')].some(input => input.value === 'Тореадор'))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
})

test.describe('compact character gestures', () => {
  test.use({ hasTouch: true })

  async function swipe(page, { reverse = false, vertical = false } = {}) {
    const { width, height } = page.viewportSize()
    const client = await page.context().newCDPSession(page)
    const start = { x: Math.round(width * (reverse ? .2 : .8)), y: height - 180 }
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (const part of [.2, .4, .6, .8, 1]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: vertical ? start.x : Math.round(start.x + width * (reverse ? .6 : -.6) * part),
        y: start.y - (vertical ? 200 * part : 0),
      }] })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
    await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  }

  for (const width of [390, 834]) test(`page swipes both ways and keeps vertical scrolling at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const api = await fixture(page)
    await page.goto('/tests/tutorials/fixtures/tutorials.html')
    const nav = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа' })
    await expect(page.locator('.character-workspace-header')).toBeVisible()
    await expect(nav.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.dnd-tablet-base')).toBeVisible()
    if (width < 600) await expect(page.locator('.dnd-tablet-base .hp-compact')).toBeVisible()
    await swipe(page)
    await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.dnd-stats:visible')).toBeVisible()
    await expect(page.locator('[data-tutorial="character-hp"]:visible')).toHaveCount(0)
    await swipe(page, { vertical: true })
    await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
    if (width < 600) await expect.poll(() => page.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll').evaluate(node => node.scrollTop)).toBeGreaterThan(0)
    await swipe(page, { reverse: true })
    await expect(nav.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('button', { name: 'Статы', exact: true }).click()
    await nav.getByRole('button', { name: 'Магия', exact: true }).click()
    await expect(nav.getByRole('button', { name: 'Магия', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(api.writes).toEqual([])
  })

  test('modal tablet sheet uses the same swipe pager', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1100 })
    await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
    await expect(page.locator('.dci-name')).toHaveText('Торин')
    await swipe(page)
    await expect(page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.dnd-stats:visible')).toBeVisible()
  })
})

for (const width of [390, 834, 1440]) test(`all sheet tabs are retained before direct selection at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const panes = page.locator(width < 1200 ? '.mobile-swipe-pane .character-sheet' : '.inner-tab-pane')
  await expect(panes).toHaveCount(width < 1200 ? 8 : 6, { timeout: 20000 })
  if (width >= 1200) await expect(page.locator('.inner-tab-pane .sheet-skeleton')).toHaveCount(0)
  await panes.evaluateAll(nodes => nodes.forEach((node, index) => { node.dataset.retainedIdentity = 'pane-' + index }))
  if (width < 600) await page.getByRole('button', { name: 'Дневник', exact: true }).click()
  else if (width < 1200) await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Дневник', exact: true }).click()
  else await page.locator('.dnd-desktop-main').getByRole('tab', { name: 'Дневник', exact: true }).click()
  await expect.poll(() => panes.evaluateAll(nodes => nodes.map(node => node.dataset.retainedIdentity))).toEqual(Array.from({ length: width < 1200 ? 8 : 6 }, (_, index) => 'pane-' + index))
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})

test('prepared inventory keeps real sections visible and replaces only a pending item', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1100 })
  const api = await fixture(page)
  api.document().values.items = { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'ready-staff', item_id: 206, count: 1 }], slots: {} }] }
  let release
  const waiting = new Promise(resolve => { release = resolve })
  await page.route('**/api/items/by-ids?*', async route => {
    await waiting
    await route.fulfill({ json: { items: [{ id: 206, typeId: 2, name: 'Учебный посох', data: { weight: 1 } }] } })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Предметы', exact: true }).click()
  const inventory = page.locator('[data-sheet-section="inventory"]:visible')
  await expect(inventory.getByRole('button', { name: 'Рюкзак', exact: true })).toBeVisible()
  await expect(inventory.locator('.inventory-bag-grid')).toBeVisible()
  await expect(inventory.locator('.share-skeleton')).toBeVisible()
  release()
  await expect(inventory.getByRole('button', { name: 'Учебный посох', exact: true })).toBeVisible()
  await expect(inventory.locator('.share-skeleton')).toHaveCount(0)
  expect(api.writes).toEqual([])
})
