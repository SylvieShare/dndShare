import { expect, test } from '@playwright/test'
import { captureUploads, expectWebp, raster } from '../image-uploads/helpers.js'
import { open, openWorldTab, setup } from './helpers.js'

test('the first map uploads from the empty workspace and the sidebar uses the same picker', async ({ page }, info) => {
  await page.setViewportSize({ width: 704, height: 932 })
  const state = await setup(page)
  const uploads = await captureUploads(page)
  let releaseUpload
  const pauseUpload = new Promise(resolve => { releaseUpload = resolve })
  await page.route('**/api/storage/images', async route => {
    await pauseUpload
    await route.fallback()
  })
  await open(page)
  const empty = page.locator('.global-map-empty')
  const upload = empty.getByRole('button', { name: 'Загрузить карту', exact: true })
  for (const width of [430, 1440, 704]) {
    await page.setViewportSize({ width, height: 932 })
    await expect(upload).toBeVisible()
    const button = await upload.boundingBox()
    const workspace = await empty.boundingBox()
    expect(button.x).toBeGreaterThan(workspace.x)
    expect(button.x + button.width).toBeLessThan(width)
    expect(button.height).toBeGreaterThanOrEqual(48)
    await empty.screenshot({ path: info.outputPath(`empty-world-${width}.png`) })
  }
  const image = await raster(page)
  try {
    const picker = page.waitForEvent('filechooser')
    await upload.click()
    const chooser = await picker
    expect(await chooser.element().getAttribute('aria-label')).toBe('Изображение карты мира')
    await chooser.setFiles({ name: 'Первая карта.png', mimeType: 'image/png', buffer: image })
    const busy = empty.getByRole('button', { name: 'Обрабатываем карту…', exact: true })
    await expect(busy).toBeDisabled()
    await expect(busy).toHaveAttribute('aria-busy', 'true')
  } finally {
    releaseUpload()
  }
  await expect(page.locator('.global-map-canvas')).toBeVisible()
  await expect(empty).toHaveCount(0)
  expect(state.maps).toMatchObject([{ name: 'Первая карта', current: true, imageId: 101 }])
  expect(uploads).toHaveLength(1)
  await expectWebp(page, uploads[0], 32, 16, true)

  await openWorldTab(page, 'Карты мира')
  const picker = page.waitForEvent('filechooser')
  await page.locator('.global-map-sidebar').getByRole('button', { name: 'Загрузить карту', exact: true }).click()
  const chooser = await picker
  expect(await chooser.element().getAttribute('aria-label')).toBe('Изображение карты мира')
  await expect(page.getByLabel('Изображение карты мира', { exact: true })).toHaveCount(1)
  await chooser.setFiles({ name: 'Регион.png', mimeType: 'image/png', buffer: image })
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText('Регион')
})

test('the empty-world upload waits until the map list loads successfully', async ({ page }) => {
  await page.setViewportSize({ width: 704, height: 932 })
  await setup(page)
  let readingFailed = true
  let startReading
  const permitRead = new Promise(resolve => { startReading = resolve })
  await page.route('**/api/sessions/test/global-maps', async route => {
    await permitRead
    if (readingFailed) await route.fulfill({ status: 503, json: { desc: 'Мир временно недоступен' } })
    else await route.fallback()
  })
  try {
    await open(page)
    const workspace = page.locator('.global-map-main')
    await expect(workspace.getByText('Открываем мир…', { exact: true })).toBeVisible()
    const upload = workspace.getByRole('button', { name: 'Загрузить карту', exact: true })
    await expect(upload).toHaveCount(0)
    startReading()
    const error = workspace.getByRole('alert')
    await expect(error).toContainText('Мир временно недоступен')
    await expect(upload).toHaveCount(0)
    readingFailed = false
    await error.getByRole('button', { name: 'Повторить', exact: true }).click()
    await expect(upload).toBeEnabled()
    await expect(error).toHaveCount(0)
  } finally {
    startReading()
  }
})
