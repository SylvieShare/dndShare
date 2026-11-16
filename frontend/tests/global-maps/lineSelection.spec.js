import { test, expect } from '@playwright/test'
import { setup, open, copy } from './helpers'

async function ready(page, width) {
  await page.setViewportSize({ width, height: 932 })
  const state = await setup(page)
  state.maps.push({ id: 'world', name: 'Мир', imageId: 1, imageUrl: '/test-global-world.svg', current: true, revision: 1, routes: [{ id: 'route', name: 'Путь', color: '#b397df', playerIds: [], points: [
    { id: 'a', x: .25, y: .35, name: 'Начало', note: 'Сохранить заметку', chapterId: 11 },
    { id: 'x', x: .35, y: .2, control: true }, { id: 'y', x: .45, y: .5, control: true },
    { id: 'b', x: .6, y: .35, name: 'Привал' }, { id: 'z', x: .7, y: .55, control: true },
    { id: 'c', x: .85, y: .35, name: 'Конец' },
  ] }] })
  await open(page)
  await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
  return state
}
async function position(path) {
  return path.evaluate(node => {
    const point = node.getPointAtLength(node.getTotalLength() * .55).matrixTransform(node.getScreenCTM())
    return { x: point.x, y: point.y }
  })
}

for (const touch of [false, true]) test.describe(touch ? 'touch' : 'mouse', () => {
  test.use({ hasTouch: touch })
  test(`line selection keeps bends visible and hold deletes only those bends (${touch ? 'touch' : 'mouse'})`, async ({ page, context }, info) => {
    const state = await ready(page, touch ? 704 : 1440)
    const initial = copy(state.maps[0].routes[0].points)
    const retained = initial.filter(point => !['x', 'y'].includes(point.id))
    const neighbor = await page.locator('.global-map-route-line').last().getAttribute('d')
    await page.locator('button[data-source-id="a"]').click()
    await expect(page.getByRole('complementary', { name: 'Настройки точки', exact: true })).toBeVisible()
    const hit = page.locator('.global-map-route-hit').first()
    const point = await position(hit)
    if (touch) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
    await expect(page.locator('.global-map-route-selection')).toHaveCount(1)
    await expect(page.getByRole('complementary', { name: /Настройки (точки|маршрута)/ })).toHaveCount(0)
    if (!touch) await page.mouse.move(10, 10)
    await expect(page.locator('[data-point-id="x"]')).toBeVisible()
    await expect(page.locator('[data-point-id="y"]')).toBeVisible()
    await expect(page.locator('[data-point-id="z"]')).toBeHidden()
    expect(state.writes).toHaveLength(0)
    const menu = page.getByRole('menu', { name: 'Линия маршрута', exact: true })
    const cdp = touch ? await context.newCDPSession(page) : null
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: point.x, y: point.y }] })
      await page.waitForTimeout(100)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: point.x, y: point.y }, { id: 2, x: point.x + 50, y: point.y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: point.x, y: point.y }, { id: 2, x: point.x + 70, y: point.y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(550)
      await expect(menu).toHaveCount(0)
      expect(state.maps[0].routes[0].points).toEqual(initial)
      expect(state.writes).toHaveLength(0)
    }
    const hold = await position(page.locator('.global-map-route-hit').nth(2))
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: hold.x, y: hold.y }] })
    else { await page.mouse.move(hold.x, hold.y); await page.mouse.down() }
    try { await expect(menu).toBeVisible() }
    finally {
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      else await page.mouse.up()
    }
    expect(state.writes).toHaveLength(0)
    await info.attach(`line-menu-${touch ? 'touch' : 'mouse'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await menu.getByRole('menuitem', { name: 'Удалить промежуточные точки', exact: true }).click()
    await expect.poll(() => state.maps[0].routes[0].points).toEqual(retained)
    expect(state.writes).toHaveLength(1)
    if (!touch) await expect(page.locator('.global-map-route-line').last()).toHaveAttribute('d', neighbor)
    await expect(page.locator('.global-map-route-selection')).toHaveCount(1)
    await expect(page.getByRole('complementary', { name: /Настройки (точки|маршрута)/ })).toHaveCount(0)
    await page.locator('.global-map-canvas').focus()
    await page.keyboard.press('Shift+F10')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Удалить промежуточные точки', exact: true })).toBeDisabled()
    expect(state.maps[0].routes[0].points).toEqual(retained)
    expect(state.writes).toHaveLength(1)
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.locator('.global-map-route-line')).toHaveCount(2)
    await expect(page.locator('[data-point-id="x"], [data-point-id="y"]')).toHaveCount(0)
    await expect(page.locator('[data-point-id="z"]')).toHaveCount(1)
    expect(state.maps[0].routes[0].points).toEqual(retained)
    await cdp?.detach()
  })
})

test('line keyboard selection opens the shared menu and Escape clears selection', async ({ page }) => {
  const state = await ready(page, 1440)
  const hit = page.locator('.global-map-route-hit[tabindex="0"]').first()
  await hit.focus()
  await page.keyboard.press('Enter')
  await expect(hit).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-point-id="x"]')).toBeVisible()
  await page.keyboard.press('Shift+F10')
  const menu = page.getByRole('menu', { name: 'Линия маршрута', exact: true })
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.locator('.global-map-route-selection')).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
})
