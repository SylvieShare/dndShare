import { test, expect } from '@playwright/test'

const copy = value => JSON.parse(JSON.stringify(value))
async function setup(page) {
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
    if (path === '/api/sessions/test') json = {
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
async function open(page) {
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test&fullApp')
  await page.getByRole('button', { name: 'Мир', exact: true }).click()
  await expect(page.locator('.global-map-workspace')).toBeVisible()
}
async function upload(page, name) {
  await page.getByRole('button', { name: 'Карты мира', exact: true }).click()
  await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: `${name}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=', 'base64') })
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText(name)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
}
for (const mobile of [false, true]) test(`world maps, curved routes and annotations persist ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1680, height: 1050 })
  const state = await setup(page)
  await open(page)
  await upload(page, 'Мир')
  const tools = page.locator('[data-tutorial="session-tools"]')
  await expect(tools.getByRole('button', { name: 'Сокровища', exact: true })).toHaveCount(0)
  const rail = await tools.boundingBox()
  const canvasBounds = await page.locator('.global-map-canvas').boundingBox()
  expect(canvasBounds.x + canvasBounds.width).toBeLessThanOrEqual(rail.x - 10)
  expect(await tools.evaluate(element => getComputedStyle(element).backdropFilter)).toContain('blur(')
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить маршрут', exact: true }).click()
  if (mobile) {
    const navigation = await page.locator('.global-map-sidebar .map-sidebar-tabs').boundingBox()
    await expect.poll(async () => (await page.locator('.global-map-sidebar').boundingBox()).width).toBeLessThanOrEqual(navigation.width + 1)
  }
  const image = await page.locator('.global-map-image').boundingBox()
  for (const [x, y] of [[.15, .18], [.45, .4], [.75, .22]]) await page.mouse.click(image.x + image.width * x, image.y + image.height * y)
  await expect(page.locator('.global-map-point')).toHaveCount(3)
  await expect(page.locator('.global-map-route-line')).toHaveAttribute('d', / C.* C/)
  await expect(page.locator('.global-map-route-outline')).toHaveCount(1)
  await expect(page.locator('.global-map-toolbar')).toHaveCount(0)
  const routeMetrics = () => page.locator('.global-map-route-line').evaluate(path => {
    const scale = new DOMMatrix(getComputedStyle(path.closest('.global-map-world')).transform).a
    return { width: Number(path.getAttribute('stroke-width')) * scale, dash: Number(path.parentElement.getAttribute('stroke-dasharray').split(' ')[0]) * scale }
  })
  const beforeZoom = await routeMetrics()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Увеличить карту мира', exact: true }).click()
  await expect.poll(async () => (await routeMetrics()).width).toBeGreaterThan(beforeZoom.width)
  expect((await routeMetrics()).dash).toBeGreaterThan(beforeZoom.dash)
  await page.getByRole('button', { name: 'Вписать карту мира', exact: true }).click()
  await page.locator('.global-map-point').nth(2).click()
  await page.getByRole('textbox', { name: 'Заметка точки', exact: true }).fill('Встречаемся у перевала')
  await page.getByLabel('Привязать точку к главе', { exact: true }).selectOption('11')
  const inspector = page.getByRole('complementary', { name: 'Настройки точки', exact: true })
  await expect(inspector).toHaveCSS('opacity', '1')
  const inspectorBounds = await inspector.boundingBox(), mainBounds = await page.locator('.global-map-main').boundingBox()
  expect(inspectorBounds.y - mainBounds.y).toBeLessThan(20)
  expect(mainBounds.x + mainBounds.width - inspectorBounds.x - inspectorBounds.width).toBeLessThan(20)
  await page.getByRole('button', { name: 'Закрыть настройки точки', exact: true }).click()
  await expect(inspector).toHaveCount(0)
  await page.locator('.global-map-point').nth(2).hover()
  await expect(page.locator('.global-map-callout')).toContainText('Встречаемся у перевала')
  await expect(page.locator('.global-map-callout')).toContainText('Перевал')
  await page.getByRole('button', { name: 'Вписать карту мира', exact: true }).hover()
  await expect(page.locator('.global-map-callout')).toHaveCount(0)
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Лира', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Торин', exact: true }).check()
  await expect(page.locator('.global-map-avatar')).toHaveCount(2)
  await expect.poll(() => state.maps[0]?.routes[0]?.playerIds).toEqual([41, 42])
  if (mobile) await page.getByRole('button', { name: 'Свернуть панель карты', exact: true }).click()
  await page.locator('.global-map-point').nth(2).click()
  await page.getByRole('button', { name: 'Передвинуть точку раньше', exact: true }).click()
  await expect.poll(() => state.maps[0]?.routes[0]?.points[1]?.note).toBe('Встречаемся у перевала')
  await page.getByRole('button', { name: 'Закрыть настройки точки', exact: true }).click()
  const marker = page.locator('.global-map-point').nth(0), before = copy(state.maps[0].routes[0].points[0])
  const box = await marker.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 15, { steps: 6 }); await page.mouse.up()
  await expect.poll(() => state.maps[0].routes[0].points[0].x).not.toBe(before.x)
  await page.getByRole('button', { name: 'Удалить точку', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.locator('.global-map-point')).toHaveCount(2)
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(2)
  await upload(page, 'Регион')
  expect(state.maps[1].current).toBe(true)
  await page.getByRole('button', { name: 'Открыть карту Мир', exact: true }).click()
  await page.getByRole('button', { name: 'Сделать текущей', exact: true }).click()
  await expect.poll(() => state.maps[0].current).toBe(true)
  await page.reload()
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText('Мир')
  await expect(page.locator('.global-map-point')).toHaveCount(2)
  await page.getByRole('button', { name: 'Карты мира', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить карту', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText('Регион')
  expect(state.maps).toHaveLength(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('failed saves preserve local notes and conflicts require explicit reload', async ({ page }) => {
  const state = await setup(page)
  await page.setViewportSize({ width: 1680, height: 1050 })
  await open(page); await upload(page, 'Мир')
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить маршрут', exact: true }).click()
  const image = await page.locator('.global-map-image').boundingBox()
  await page.mouse.click(image.x + image.width * .3, image.y + image.height * .3)
  await expect.poll(() => state.maps[0]?.routes[0]?.points.length).toBe(1)
  await page.locator('.global-map-point').click()
  state.failNext(500)
  await page.getByRole('textbox', { name: 'Заметка точки', exact: true }).fill('Не потерять')
  await expect(page.getByRole('alert')).toContainText('Нет связи')
  await expect(page.getByRole('textbox', { name: 'Заметка точки', exact: true })).toHaveValue('Не потерять')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect.poll(() => state.maps[0].routes[0].points[0].note).toBe('Не потерять')
  state.failNext(409)
  await page.getByRole('textbox', { name: 'Заметка точки', exact: true }).fill('Конфликт')
  await expect(page.getByRole('alert')).toContainText('другом окне')
  await page.getByRole('button', { name: 'Загрузить с сервера', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Загрузить', exact: true }).click()
  await page.locator('.global-map-point').click()
  await expect(page.getByRole('textbox', { name: 'Заметка точки', exact: true })).toHaveValue('Не потерять')
})
