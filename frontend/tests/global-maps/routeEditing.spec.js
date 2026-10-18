import { test, expect } from '@playwright/test'
import { open, setup } from './helpers'

async function ready(page) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const state = await setup(page)
  state.maps.push({ id: 'world', name: 'Мир', imageId: 1, imageUrl: '/test-global-world.svg', current: true, revision: 1, routes: [
    { id: 'route', name: 'Путь', color: '#b397df', playerIds: [], points: [
      { id: 'a', x: .2, y: .45, name: 'Начало', note: 'Общая заметка' },
      { id: 'b', x: .5, y: .45, name: 'Привал' }, { id: 'c', x: .8, y: .45, name: 'Конец' },
    ] },
  ] })
  await open(page)
  await expect(page.locator('button.global-map-point')).toHaveCount(3)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
  return state
}
async function atImage(page, x, y) {
  const box = await page.locator('.global-map-image').boundingBox()
  return { x: box.x + box.width * x, y: box.y + box.height * y }
}
async function center(locator) { const box = await locator.boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } }

test('Cmd previews and cancels continuation, reuses a shared point and retains it after deleting its first visit', async ({ page }) => {
  const state = await ready(page)
  const candidate = await atImage(page, .4, .7)
  await page.mouse.move(candidate.x, candidate.y)
  await page.keyboard.down('Meta')
  await expect(page.locator('.global-map-ghost')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.global-map-ghost')).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
  await page.mouse.move(candidate.x + 10, candidate.y)
  await expect(page.locator('.global-map-ghost')).toHaveCount(0)
  await page.keyboard.up('Meta')
  await page.keyboard.down('Meta')
  await page.mouse.move(candidate.x, candidate.y)
  await page.mouse.click(candidate.x, candidate.y)
  await page.keyboard.up('Meta')
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(4)
  await page.getByRole('button', { name: 'Закрыть настройки точки', exact: true }).click()
  await page.locator(`button[data-source-id="${state.maps[0].routes[0].points[3].id}"]`).hover()
  await expect(page.locator('.global-map-callout')).toContainText('Точка 4')
  const source = page.locator('button[data-source-id="a"]'), position = await center(source)
  await page.mouse.move(position.x, position.y)
  await page.keyboard.down('Meta')
  await expect(page.locator('.global-map-ghost')).toContainText('↻')
  await page.mouse.click(position.x, position.y)
  await page.keyboard.up('Meta')
  await expect.poll(() => state.maps[0].routes[0].points.at(-1).refId).toBe('a')
  await expect(page.locator('button.global-map-point')).toHaveCount(4)
  await expect(source).toHaveText('1·5')
  await expect(source.locator('..').getByRole('img', { name: 'Последняя точка маршрута' })).toBeVisible()
  const next = await atImage(page, .65, .7)
  await page.mouse.move(next.x, next.y)
  await page.keyboard.down('Meta')
  await expect(page.locator('.global-map-ghost')).toBeVisible()
  await page.mouse.click(next.x, next.y)
  await page.keyboard.up('Meta')
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(6)
  await expect(source.locator('..').getByRole('img', { name: 'Последняя точка маршрута' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByLabel('Добавить существующую точку', { exact: true }).selectOption('b')
  await expect.poll(() => state.maps[0].routes[0].points.at(-1).refId).toBe('b')
  await page.getByRole('textbox', { name: 'Название точки', exact: true }).fill('Общий привал')
  await expect.poll(() => state.maps[0].routes[0].points[1].name).toBe('Общий привал')
  expect(state.maps[0].routes[0].points.at(-1).name).toBeUndefined()
  await page.reload()
  await expect(page.locator('button[data-source-id="b"]')).toHaveText('2·7')
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByRole('button', { name: '2. Общий привал', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить точку', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(6)
  expect(state.maps[0].routes[0].points.at(-1)).toMatchObject({ id: 'b', name: 'Общий привал', x: .5, y: .45 })
})

test('dragging a route creates and selects a bend without an inspector; Delete removes it and Escape cancels a drag', async ({ page }) => {
  const state = await ready(page)
  const segment = page.locator('.global-map-route-hit').first()
  const position = await segment.evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM())
    return { x: point.x, y: point.y }
  })
  await page.mouse.move(position.x, position.y)
  await page.mouse.down()
  await page.mouse.move(position.x + 25, position.y + 80, { steps: 8 })
  await expect(page.locator('.global-map-control')).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.up()
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(4)
  expect(state.maps[0].routes[0].points[1].control).toBe(true)
  await expect(page.getByRole('complementary', { name: 'Настройки точки', exact: true })).toHaveCount(0)
  await page.keyboard.press('Delete')
  await expect(page.locator('.global-map-control')).toHaveCount(0)
  await expect.poll(() => state.maps[0].routes[0].points.length).toBe(3)
  const writes = state.writes.length
  await page.mouse.move(position.x, position.y)
  await page.mouse.down()
  await page.mouse.move(position.x, position.y - 60, { steps: 6 })
  await expect(page.locator('.global-map-control')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('.global-map-control')).toHaveCount(0)
  expect(state.writes).toHaveLength(writes)
})

test('a point shared with another route survives deletion of its original route', async ({ page }) => {
  const state = await ready(page)
  await page.getByRole('button', { name: 'Маршруты', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить маршрут', exact: true }).click()
  await page.getByLabel('Добавить существующую точку', { exact: true }).selectOption('a')
  await page.getByRole('button', { name: 'Обзор', exact: true }).click()
  await page.getByRole('textbox', { name: 'Название точки', exact: true }).fill('Общий старт')
  await expect.poll(() => state.maps[0].routes[0].points[0].name).toBe('Общий старт')
  await page.getByRole('button', { name: 'Путь · 3', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить маршрут', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect.poll(() => state.maps[0].routes.length).toBe(1)
  expect(state.maps[0].routes[0].points[0]).toMatchObject({ id: 'a', name: 'Общий старт', note: 'Общая заметка', x: .2, y: .45 })
  await page.reload()
  await expect(page.locator('button.global-map-point')).toHaveCount(1)
  await expect(page.locator('button[data-source-id="a"]')).toBeVisible()
})
