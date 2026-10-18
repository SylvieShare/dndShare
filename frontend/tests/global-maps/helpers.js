import { expect } from '@playwright/test'

export const copy = value => JSON.parse(JSON.stringify(value))
export async function setup(page) {
  const maps = [], writes = []
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
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method()
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/user/checkAuth') json = { auth: true, user: { id: 1, roles: [], login: 'Мастер' } }
    else if (path === '/api/sessions/test') json = {
      session: { uuid: 'test', name: 'Путешествие', ownerUserId: 1, systemId: 1, status: 'stopped' }, myRole: 'gm',
      participants: [41, 42].map((id, index) => ({ charId: id, charUuid: `hero-${id}`, templateId: 1, iconImageUrl: image, data: { values: { name: ['Лира', 'Торин'][index], classes: [], hp: { current: 10, max: { base: 10, bonuses: [] } }, DEX: { value: 10 }, WIS: { value: 10 }, INT: { value: 10 }, armor: {} } } })),
    }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path.endsWith('/chapter-graph')) json = { arcs: [{ id: 1, order: 1, name: 'Путь' }], chapters: [{ id: 11, arcId: 1, number: '1', name: 'Перевал', status: 'planned', imageUrl: image, positionX: 100, positionY: 100 }], edges: [] }
    else if (path.endsWith('/encounter')) json = { active: false, round: 0, turnIndex: 0, combatants: [] }
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
      if (method === 'PUT') {
        const body = route.request().postDataJSON()
        writes.push(copy(body))
        if (fail) { const status = fail; fail = 0; return route.fulfill({ status, json: { desc: status === 409 ? 'Карта изменена в другом окне' : 'Нет связи' } }) }
        if (body.revision !== map.revision) return route.fulfill({ status: 409, json: { desc: 'Конфликт версии' } })
        Object.assign(map, body, { revision: map.revision + 1 }); json = copy(map)
      }
    }
    await route.fulfill({ json })
  })
  return { maps, writes, failNext: status => { fail = status } }
}
export async function open(page) {
  await page.goto('/sessions/test')
  await page.getByRole('button', { name: 'Мир', exact: true }).click()
  await expect(page.locator('.global-map-workspace')).toBeVisible()
}
export async function upload(page, name) {
  await page.getByRole('button', { name: 'Карты мира', exact: true }).click()
  await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: `${name}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=', 'base64') })
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText(name)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
}
