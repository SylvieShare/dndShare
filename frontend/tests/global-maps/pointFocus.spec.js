import { test, expect } from '@playwright/test'
import { open, setup, dismissWorldFocus } from './helpers'
async function ready(page, mobile) {
  await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1600, height: 1000 })
  const state = await setup(page)
  state.maps.push({ id: 'world', name: 'Мир', imageId: 1, imageUrl: '/test-global-world.svg', current: true, revision: 1, routes: [{ id: 'route', name: 'Путь', color: '#b397df', playerIds: [], points: [
    { id: 'a', name: 'Начало', x: .25, y: .4 }, { id: 'b', name: 'Перевал', x: .7, y: .6 },
  ] }] })
  await open(page)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
  await page.locator('button[data-source-id="a"]').click()
  return state
}
for (const mobile of [false, true]) test(`point focus shares framed reference and preview, follows zoom ×2 (${mobile})`, async ({ page }) => {
  await ready(page, mobile)
  const focus = page.getByRole('complementary', { name: 'Настройки точки', exact: true })
  await expect(focus.locator('.workspace-focus-content')).toHaveClass(/base-tile--framed/)
  const preview = focus.getByRole('figure', { name: /Точка на карте/ })
  await expect(preview).toHaveAttribute('data-preview-state', 'ready')
  async function metrics() {
    return page.evaluate(() => {
      const preview = document.querySelector('.global-map-point-preview'), rect = preview.getBoundingClientRect()
      const marker = preview.querySelector('.global-map-point--selected').getBoundingClientRect()
      return {
        canvasScale: new DOMMatrix(getComputedStyle(document.querySelector('.global-map-world')).transform).a,
        previewScale: new DOMMatrix(getComputedStyle(preview.querySelector('.global-map-preview-scene')) .transform).a,
        centre: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        point: { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 },
        pointRatio: marker.width / document.querySelector('button[data-source-id="a"]').getBoundingClientRect().width,
      }
    })
  }
  for (let i = 0; i < 2; i++) {
    const m = await metrics()
    expect(m.previewScale).toBeCloseTo(m.canvasScale * 2)
    expect(m.point.x).toBeCloseTo(m.centre.x, 1)
    expect(m.point.y).toBeCloseTo(m.centre.y, 1)
    expect(m.pointRatio).toBeCloseTo(1, 2)
    await page.getByRole('button', { name: 'Увеличить карту мира', exact: true }).click()
  }
  const trash = await focus.getByRole('button', { name: 'Удалить точку', exact: true }).boundingBox()
  const routeBounds = await focus.getByRole('button', { name: 'Открыть маршрут Путь', exact: true }).boundingBox()
  expect(trash.y).toBeLessThan(routeBounds.y)
  await expect(focus.getByText(/Точка \d+ из \d+/)).toHaveCount(0)
  await expect(focus.getByRole('button', { name: 'Закрыть настройки точки', exact: true })).toHaveCount(0)
  const route = focus.getByRole('button', { name: 'Открыть маршрут Путь', exact: true })
  await expect(route).toHaveClass(/inspector-reference/)
  await route.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Настройки маршрута', exact: true })).toBeVisible()
})

for (const mobile of [false, true]) test(`world sidebar overlays a stable canvas like the map editor (${mobile})`, async ({ page }) => {
  await ready(page, mobile)
  await dismissWorldFocus(page)
  await page.getByRole('button', { name: 'Карты мира', exact: true }).click()
  await expect(page.locator('.global-map-sidebar')).toHaveClass(/map-sidebar--overlay/)
  const canvas = await page.locator('.global-map-canvas').boundingBox()
  const rail = await page.locator('.map-sidebar-tabs').boundingBox()
  expect(canvas.x).toBeCloseTo(rail.x + rail.width)
  await page.getByRole('button', { name: 'Свернуть панель карты', exact: true }).click()
  await expect.poll(async () => (await page.locator('.global-map-sidebar').boundingBox()).width).toBe(77)
  expect(await page.locator('.global-map-canvas').boundingBox()).toEqual(canvas)
})

test('point preview follows edits and reports its image failure without affecting the canvas', async ({ page }) => {
  const state = await ready(page, false)
  const preview = page.locator('.global-map-point-preview')
  await expect(preview).toHaveAttribute('data-preview-state', 'ready')
  await page.locator('button[data-source-id="a"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => state.maps[0].routes[0].points[0].x).toBeGreaterThan(.25)
  const centre = await preview.boundingBox(), marker = await preview.locator('.global-map-point--selected').boundingBox()
  expect(marker.x + marker.width / 2).toBeCloseTo(centre.x + centre.width / 2, 1)
  await preview.locator('img').dispatchEvent('error')
  await expect(preview).toHaveAttribute('data-preview-state', 'unavailable')
  await expect(preview).toContainText('Не удалось открыть изображение карты')
  await expect(page.locator('.global-map-image')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('markers use the loaded image aspect before selection when fit keeps scale one', async ({ page }) => {
  await page.setViewportSize({ width: 1341, height: 1000 })
  const state = await setup(page)
  await page.route('**/test-global-world.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#d6c7a3"/></svg>' }))
  state.maps.push({ id: 'world', name: 'Мир', imageId: 1, imageUrl: '/test-global-world.svg', current: true, revision: 1, routes: [{ id: 'route', name: 'Путь', color: '#b397df', playerIds: [], points: [{ id: 'a', name: 'Начало', x: .5, y: .75 }] }] })
  await open(page)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
  const image = await page.locator('.global-map-image').boundingBox(), marker = await page.locator('button[data-source-id="a"]').boundingBox()
  expect(image.height).toBeCloseTo(600)
  expect(marker.x + marker.width / 2).toBeCloseTo(image.x + image.width * .5, 1)
  expect(marker.y + marker.height / 2).toBeCloseTo(image.y + image.height * .75, 1)
})
