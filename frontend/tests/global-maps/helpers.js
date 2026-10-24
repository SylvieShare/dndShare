import {applyDocumentPatches} from '../../src/shared/lib/documentPatch.js'
import { expect } from '@playwright/test'

export const copy = value => JSON.parse(JSON.stringify(value))
export async function setup(page) {
  const maps = [], writes = []
  const encounter = { version: 0, data: { active: false, round: 0, turnIndex: 0, combatants: [] } }
  const chapters = [
    { id: 11, arcId: 1, number: '1', name: 'Перевал', status: 'planned', imageUrl: '/test-global-world.svg', positionX: 100, positionY: 100 },
    { id: 12, arcId: 1, number: '2', name: 'Долина', status: 'planned', positionX: 300, positionY: 100 },
  ]
  const locations = [{ id: 21, name: 'Северная башня', imageUrl: '/test-global-world.svg', kind: 'building' }, { id: 22, name: 'Лесная тропа', kind: 'region' }]
  let nextId = 1, fail = 0
  const image = '/test-global-world.svg'
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    window.EventSource = class {
      constructor() { setTimeout(() => this.onopen?.(), 0) }
      addEventListener() {} removeEventListener() {} close() {}
    }
  })
  await page.route('**/test-global-world.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#d6c7a3"/><path d="M0 600Q500 100 1200 400" stroke="#99b3bd" stroke-width="30" fill="none"/></svg>' }))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method()
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/user/checkAuth') json = { auth: true, user: { id: 1, roles: [], login: 'Мастер' } }
    else if (path === '/api/sessions/test') json = {
      session: { uuid: 'test', name: 'Путешествие', ownerUserId: 1, systemId: 1, status: 'stopped', currentChapterId: 11 }, myRole: 'gm',
      participants: [41, 42].map((id, index) => ({ charId: id, charUuid: `hero-${id}`, templateId: 1, iconImageUrl: image, data: { values: { name: ['Лира', 'Торин'][index], classes: [], hp: { current: 10, max: { base: 10, bonuses: [] } }, DEX: { value: 10 }, WIS: { value: 10 }, INT: { value: 10 }, armor: {} } } })),
    }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path.endsWith('/chapter-graph')) json = { arcs: [{ id: 1, order: 1, name: 'Путь' }], chapters, edges: [] }
    else if (path === '/api/sessions/test/world') json = { locations, npcs: [], quests: [], materials: [], relations: [] }
    else if (path === '/api/sessions/test/encounter') {
      if (method === 'PATCH') {
        const body = route.request().postDataJSON()
        encounter.data = applyDocumentPatches(encounter.data, body.patches)
        encounter.version++
        json = { version: encounter.version, patches: body.patches }
      } else json = copy(encounter)
    }
    else if (path === '/api/sessions/test/encounter/changes') json = copy(encounter)
    else if (path === '/api/account/tutorials') json = { tutorials: ['desktop', 'mobile'].map(device => ({ flowId: 'session-dm', sourceKey: 'source:1', device, status: 'completed', revision: 1 })) }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/storage/images') json = { upload_id: nextId, url: image }
    else if (path.endsWith('/global-maps')) {
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        maps.forEach(map => { map.current = false })
        json = { id: `map-${nextId++}`, name: body.name, imageId: body.imageId, imageUrl: image, routes: [], current: true, revision: 1 }
        maps.push(copy(json))
      } else json = { maps: copy(maps) }
    } else if (/\/global-maps\//.test(path)) {
      const id = path.split('/')[5], map = maps.find(map => map.id === id)
      if (path.endsWith('/activate')) { maps.forEach(map => { map.current = map.id === id }); return route.fulfill({ status: 204 }) }
      if (method === 'DELETE') {
        maps.splice(maps.findIndex(map => map.id === id), 1)
        if (!maps.some(map => map.current) && maps.length) maps[0].current = true
        return route.fulfill({ status: 204 })
      }
      if(path.endsWith('/changes'))return route.fulfill({json:{version:map.revision,data:{name:map.name,routes:map.routes},metadata:{id:map.id,current:map.current}}})
      if (method === 'PATCH') {
        const body = route.request().postDataJSON()
        writes.push(copy(body))
        if (fail) { const status = fail; fail = 0; if(status===409){map.routes[0].points[0].note='Серверная заметка';map.revision++}; return route.fulfill({ status, json: { desc: status === 409 ? 'Карта изменена в другом окне' : 'Нет связи' } }) }
        if (body.baseVersion !== map.revision) return route.fulfill({ status: 409, json: { desc: 'Конфликт версии' } })
        Object.assign(map,applyDocumentPatches({name:map.name,routes:copy(map.routes)},body.patches),{revision:map.revision+1});json={version:map.revision,patches:body.patches,metadata:{id:map.id,current:map.current}}
      }
    }
    await route.fulfill({ json })
  })
  return { maps, writes, chapters, locations, failNext: status => { fail = status } }
}
export async function open(page) {
  await page.goto('/sessions/test')
  await page.getByRole('button', { name: 'Мир', exact: true }).click()
  await expect(page.locator('.global-map-workspace')).toBeVisible()
}
export async function upload(page, name) {
  await openWorldTab(page, 'Карты мира')
  await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: `${name}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=', 'base64') })
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText(name)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
}

export async function openRoute(page, name = 'Путь') {
  await openWorldTab(page, 'Маршруты')
  await page.locator('.global-map-sidebar').getByRole('button', { name: `Открыть маршрут ${name}`, exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Настройки маршрута', exact: true })).toHaveCSS('opacity', '1')
}

export async function dismissWorldFocus(page) {
  await page.locator('.global-map-canvas').focus()
  await page.keyboard.press('Escape')
}
export async function renameWorldPoint(page, name) {
  const focus = page.getByRole('complementary', { name: 'Настройки точки', exact: true })
  await focus.getByRole('button', { name: 'Изменить название точки', exact: true }).click()
  await focus.getByRole('textbox', { name: 'Название точки', exact: true }).fill(name)
  await page.keyboard.press('Enter')
}
export async function reuseWorldPoint(page, id) {
  await page.getByRole('button', { name: 'Добавить точку на карту', exact: true }).click()
  await page.locator(`button[data-source-id="${id}"]`).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await page.locator('.global-route-point-open').last().click()
}

export async function openWorldTab(page, name) {
  const button = page.locator('.global-map-sidebar').getByRole('button', { name, exact: true })
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}
