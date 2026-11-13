import { expect, test } from '@playwright/test'

async function nativeFixture(page, mode = 'success') {
  await page.addInitScript(({ mode }) => {
    window.CapacitorCustomPlatform = { name: 'android' }
    window.__nativeCalls = []
    window.__nativeMode = mode
    window.Capacitor = {
      PluginHeaders: [{ name: 'ReportCapture', methods: [{ name: 'captureViewport', rtype: 'promise' }] }],
      nativePromise: async (plugin, method) => {
        if (plugin !== 'ReportCapture' || method !== 'captureViewport') throw Error('Unexpected bridge call')
        window.__nativeCalls.push({ picker: !!document.querySelector('.selection-hint'), form: !!document.getElementById('error-report-form') })
        const image = document.createElement('canvas')
        image.width = 80; image.height = 160
        image.getContext('2d').fillRect(0, 0, 80, 160)
        const result = { dataURL: image.toDataURL('image/jpeg'), width: 80, height: 160 }
        if (window.__nativeMode === 'failure') throw Error('Copy failed')
        if (window.__nativeMode === 'pending') return new Promise(resolve => { window.__finishNative = () => resolve(result) })
        return result
      },
    }
  }, { mode })
  await page.goto('/tests/error-reports/fixtures/native-capture.html')
  await expect(page.locator('#report-target')).toBeVisible()
}

async function selectTarget(page) {
  await page.keyboard.press('Alt+Shift+E')
  await expect(page.locator('.selection-hint')).toBeVisible()
  await page.locator('#report-target').click()
}

test('Android captures a clean viewport once and retains it across context changes and submit retry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  let attempts = 0
  let submitted
  await page.route('**/api/error-reports', route => {
    submitted = route.request().postDataJSON()
    return ++attempts === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ status: 201, json: { id: 1 } })
  })
  await nativeFixture(page)
  await selectTarget(page)
  const dialog = page.getByRole('dialog', { name: 'Что работает неправильно?' })
  const screen = dialog.getByAltText('Скриншот экрана приложения')
  await expect(screen).toBeVisible()
  await expect(dialog.getByAltText('Скриншот выбранного элемента')).toBeVisible()
  expect(await page.evaluate(() => window.__nativeCalls)).toEqual([{ picker: false, form: false }])
  const original = await screen.getAttribute('src')
  await dialog.getByRole('button', { name: 'Взять больше контекста' }).click()
  await expect(dialog.getByRole('button', { name: 'Взять меньше контекста' })).toBeEnabled()
  await dialog.getByRole('textbox').fill('Ошибка на экране приложения')
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog.getByText('Не удалось отправить заявку. Попробуйте ещё раз.')).toBeVisible()
  await expect(screen).toHaveAttribute('src', original)
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted.viewportScreenshot).toBe(original)
  expect(submitted.screenshot).toMatch(/^data:image\/jpeg;base64,/)
  expect(await page.evaluate(() => window.__nativeCalls.length)).toBe(1)
})

test('native viewport failure still allows a report with its selected-element screenshot', async ({ page }) => {
  let submitted
  await page.route('**/api/error-reports', route => { submitted = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { id: 1 } }) })
  await nativeFixture(page, 'failure')
  await selectTarget(page)
  const dialog = page.getByRole('dialog', { name: 'Что работает неправильно?' })
  await expect(dialog.getByText('Не удалось создать снимок экрана.', { exact: false })).toBeVisible()
  await dialog.getByRole('textbox').fill('Ошибка без полного снимка')
  await expect(dialog.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted.viewportScreenshot).toBeUndefined()
  expect(submitted.screenshot).toMatch(/^data:image\/jpeg;base64,/)
})

test('native Back cancels a pending copy and a late result cannot open the form', async ({ page }) => {
  await nativeFixture(page, 'pending')
  await selectTarget(page)
  await expect.poll(() => page.evaluate(() => window.__nativeCalls.length)).toBe(1)
  expect(await page.evaluate(() => {
    const back = new Event('dndshare:back', { cancelable: true })
    window.dispatchEvent(back)
    window.__finishNative()
    return back.defaultPrevented
  })).toBe(true)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => { window.__nativeMode = 'success' })
  await selectTarget(page)
  await expect(page.getByAltText('Скриншот экрана приложения')).toBeVisible()
  expect(await page.evaluate(() => window.__nativeCalls.length)).toBe(2)
})
