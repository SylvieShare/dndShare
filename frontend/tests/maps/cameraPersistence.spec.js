import { test, expect } from '@playwright/test'

for (const mode of ['editor', 'board'])
  test(`camera edits and undo during delayed saves retain the latest data in ${mode}`, async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/tests/maps/fixtures/maps.html?mode=${mode}`)
    await expect(page.locator('.map-canvas canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Камеры', exact: true }).click()
    await page
      .getByRole('button', { name: 'Добавить камеру', exact: true })
      .click()
    const saved = () =>
      page.evaluate(
        (mode) => (mode === 'editor' ? window.lastSaved : window.latestBoard),
        mode,
      )
    await expect
      .poll(async () => (await saved())?.document.cameras?.length)
      .toBe(1)
    const original = (await saved()).document.cameras[0]
    const focus = page.getByRole('complementary', {
      name: 'Выбранные элементы',
    })
    const width = focus.locator('[aria-label="Ширина кадра"] input')
    await page.evaluate(() => {
      const original = window.fetch
      window.fetch = async (url, options = {}) => {
        if (
          window.holdCameraSave &&
          options.method === 'PATCH' &&
          /\/maps\/[^/]+$/.test(String(url))
        ) {
          window.holdCameraSave = false
          const response = await original(url, options)
          await new Promise((resolve) => {
            window.releaseCameraSave = resolve
          })
          return response
        }
        return original(url, options)
      }
      window.holdCameraSave = true
    })
    await width.fill('12')
    await width.press('Enter')
    await page.waitForFunction(() => window.releaseCameraSave)
    await width.fill('13')
    await width.press('Enter')
    const x = focus.locator('[aria-label="Камера: X"] input')
    await x.fill('8.25')
    await x.press('Enter')
    await page.waitForTimeout(1400)
    await page.evaluate(() => window.releaseCameraSave())
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.view.width)
      .toBe(13)
    expect((await saved()).document.cameras[0].view.position[0]).toBe(8.25)
    await page.evaluate(() => {
      delete window.releaseCameraSave
      window.holdCameraSave = true
    })
    await focus
      .getByRole('button', { name: 'Удалить камеру', exact: true })
      .click()
    await page.waitForFunction(() => window.releaseCameraSave)
    expect((await saved()).document.cameras).toBeUndefined()
    await page.locator('.map-canvas-surface').focus()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1400)
    await page.evaluate(() => window.releaseCameraSave())
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.id)
      .toBe(original.id)
    await page.keyboard.press('Control+Shift+z')
    await expect
      .poll(async () => (await saved())?.document.cameras)
      .toBeUndefined()
    await page.keyboard.press('Control+z')
    await expect
      .poll(async () => (await saved())?.document.cameras?.[0]?.id)
      .toBe(original.id)
    expect((await saved()).document.cameras[0].view.width).toBe(13)
    await expect(
      page.getByRole('dialog', { name: 'Не удалось сохранить карту' }),
    ).toHaveCount(0)
    expect(errors).toEqual([])
  })
