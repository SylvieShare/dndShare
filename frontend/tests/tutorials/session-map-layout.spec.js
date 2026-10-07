import { test, expect } from '@playwright/test'
import { initialState, newMap } from '../../src/features/maps/lib/mapModel'

for (const mobile of [false, true]) test(`session shares the map between full workspace and combat overlays ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1680, height: 1000 })
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    window.EventSource = class {
      constructor() { setTimeout(() => this.onopen?.(), 0) }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
  })
  const map = { ...newMap(), id: 'session-map', name: 'Крепость', revision: 1, state: initialState() }
  map.state.fog = false
  const display = { mapId: map.id, visible: false, revision: 1, camera: { x: 6, y: 5, cellPixels: 64, rotation: 0, fit: true } }
  let encounter = {
    active: true, round: 1, turnIndex: 0,
    combatants: [
      { uid: 'goblin', type: 'npc', position: 'combat', initiative: 15, tieBreak: 1, markerLetter: 'A', side: 'enemy', hpCurrent: 10, override: { name: 'Гоблин', hpMax: 10, ac: 12 } },
      { uid: 'orc', type: 'npc', position: 'combat', initiative: 10, tieBreak: 2, markerLetter: 'B', side: 'enemy', hpCurrent: 12, override: { name: 'Орк', hpMax: 12, ac: 13 } },
    ],
  }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (route.request().method() === 'PUT' && path.endsWith('/encounter')) {
      encounter = route.request().postDataJSON()
      return route.fulfill({ json: encounter })
    }
    let json = {}
    if (path === '/api/sessions/test') json = { session: { uuid: 'test', name: 'Поход', ownerUserId: 1, systemId: 1, displayCode: 'ABC', status: 'active' }, participants: [], myRole: 'gm' }
    else if (path.endsWith('/encounter')) json = encounter
    else if (path === '/api/sessions/test/maps') json = { maps: [map], display }
    else if (path === '/api/account/tutorials') json = { tutorials: [{ flowId: 'session-dm', sourceKey: 'source:1', device: mobile ? 'mobile' : 'desktop', status: 'completed', revision: 1 }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    await route.fulfill({ json })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test&admin')
  await page.getByRole('button', { name: 'Карта', exact: true }).click()
  await expect(page.locator('.session-map-workspace')).toBeVisible()
  await expect(page.getByText('Подготавливаем карту…')).toHaveCount(0)
  const before = await page.locator('.map-canvas canvas').elementHandle()
  const canvas = await page.locator('.map-canvas-surface').boundingBox()
  const stage = await page.locator('.chapter-canvas-stage').boundingBox()
  expect(canvas).toEqual(stage)
  if (!mobile) {
    const inspector = await page.locator('.session-map-inspector').boundingBox()
    const players = await page.locator('[data-tutorial="session-players"]').boundingBox()
    expect(inspector.x + inspector.width).toBeLessThan(players.x)
  }
  await page.getByRole('button', { name: /^Открыть бой/ }).click()
  await expect(page.getByRole('region', { name: 'Линия инициативы' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Текущий ход' })).toContainText('Гоблин')
  expect(await before.evaluate(element => element.isConnected)).toBe(true)
  await page.getByRole('button', { name: 'Следующий ход', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Текущий ход' })).toContainText('Орк')
  await page.getByRole('button', { name: 'Состав боя и запас', exact: true }).click()
  await expect(page.getByText('ЗАПАС НПС', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Состав боя и запас', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Линия инициативы' })).toBeVisible()
  await page.getByRole('button', { name: 'Карта', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Линия инициативы' })).toHaveCount(0)
  expect(await before.evaluate(element => element.isConnected)).toBe(true)
  await expect(page.locator('.session-map-workspace')).toBeVisible()
})
