import { test, expect } from '@playwright/test'
import { mapPoint } from './editorHelpers'

for (const mode of ['editor', 'board'])
  test(`captured map pan continues outside the canvas and releases cleanly in ${mode}`, async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}`)
    const surface = page.locator('.map-canvas-surface')
    await expect(surface.locator('canvas')).toBeVisible()
    await page.getByTitle('Вид сверху', { exact: true }).click()
    const readView = () =>
      page
        .locator('.map-canvas')
        .evaluate((el) => el.__vueParentComponent.exposed.getView())
    const bounds = await surface.boundingBox()
    const start = await mapPoint(page, 8, 6)
    const before = await readView()
    await page.mouse.move(start.x, start.y)
    await page.keyboard.down('Alt')
    await page.mouse.down()
    // The header is outside the canvas but inside the browser viewport.
    for (const y of [
      bounds.y - 2,
      bounds.y - 5,
      bounds.y - 8,
      bounds.y - 11,
      bounds.y - 14,
      bounds.y - 17,
    ]) {
      await page.mouse.move(start.x, y)
      await page.evaluate(() => new Promise(requestAnimationFrame))
    }
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const outside = await readView()
    expect(outside.x !== before.x || outside.y !== before.y).toBe(true)
    const released = await surface.evaluate((el) => el.hasPointerCapture(1))
    expect(released).toBe(false)
    await page.mouse.move(start.x, start.y)
    await page.keyboard.down('Alt')
    await page.mouse.down()
    await page.mouse.move(start.x + 25, start.y + 20)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const after = await readView()
    expect(after.x !== outside.x || after.y !== outside.y).toBe(true)
    expect(errors).toEqual([])
  })
