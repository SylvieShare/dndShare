import { test, expect } from '@playwright/test'

async function ready(page, options) {
  page.on('pageerror', error => { throw error })
  await page.goto(`/tests/maps/fixtures/maps.html?mode=board&${options}`)
  await expect(page.locator('.map-canvas canvas')).toBeVisible()
  await expect(page.getByText('Подготавливаем карту…')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
}

for (const mobile of [false, true]) {
  test(`session area visibility survives panel switches ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 })
    await ready(page, 'areaExample&hiddenArea')
    const canvas = await page.locator('.map-canvas-surface').boundingBox()
    const workspace = await page.locator('.session-map-workspace').boundingBox()
    expect(canvas).toEqual(workspace)
    await page.getByRole('button', { name: 'Области', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'Зал', exact: true })).not.toBeChecked()
    await page.getByRole('switch', { name: 'Зал', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.latestBoard.state.areas?.['area-room'])).toBe(true)
    expect(await page.evaluate(() => window.latestBoard.document.areas[0].hidden)).toBe(true)
    await page.getByRole('button', { name: 'Свернуть управление картой', exact: true }).click()
    await expect(page.locator('.session-map-inspector')).toHaveClass(/collapsed/)
    await page.getByRole('button', { name: 'Области', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'Зал', exact: true })).toBeChecked()
  })

  test(`session lighting saves independent overrides ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 })
    await ready(page, 'lightExample&lit')
    await page.getByRole('button', { name: 'Освещение', exact: true }).click()
    await page.getByRole('switch', { name: 'Факел', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.latestBoard.state.lighting?.lights['test-light'])).toBe(false)
    await page.getByRole('switch', { name: 'Дневной свет', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.latestBoard.state.lighting?.sun.enabled)).toBe(true)
    const angle = page.getByRole('slider', { name: 'Направление дневного света', exact: true })
    await angle.focus()
    await angle.press('ArrowRight')
    await expect.poll(() => page.evaluate(() => window.latestBoard.state.lighting?.sun.angle)).toBe(226)
    await page.getByRole('switch', { name: 'Освещение', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.latestBoard.state.lighting?.enabled)).toBe(false)
    await expect(angle).toBeDisabled()
    const source = await page.evaluate(() => window.latestBoard.document)
    expect(source.lightingEnabled).toBe(true)
    expect(source.sun.enabled).toBe(false)
    expect(source.lights[0].enabled).toBe(true)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
