import { test, expect } from '@playwright/test'
import { setup } from '../global-maps/helpers'
import { captureUploads, expectWebp, raster } from './helpers'

test.beforeEach(async ({ page }) => {
  await setup(page)
  await page.route('https://**', route => route.abort())
  await page.goto('/sessions/test', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Мир', exact: true }).click()
  await expect(page.locator('.global-map-sidebar')).toBeVisible()
})

for (const mobile of [false, true]) test(`30 MiB PNG keeps its name and transparency ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 430, height: 932 })
  const uploads = await captureUploads(page)
  const original = await raster(page)
  const buffer = Buffer.alloc(30 * 1024 * 1024); original.copy(buffer)
  await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: 'Большой мир.png', mimeType: 'image/png', buffer })
  await expect(page.locator('.global-map-thumbnail--selected')).toContainText('Большой мир')
  expect(uploads).toHaveLength(1)
  expect(uploads[0].name).toBe('Большой мир.webp')
  expect(uploads[0].bytes.length).toBeLessThan(4096)
  await expectWebp(page, uploads[0], 32, 16, true)
})

test('JPEG is converted and existing WebP stays byte-for-byte unchanged', async ({ page }) => {
  const uploads = await captureUploads(page)
  for (const type of ['image/jpeg', 'image/webp']) {
    const buffer = await raster(page, type)
    await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: type === 'image/jpeg' ? 'Фото.jpg' : 'Мир.webp', mimeType: type, buffer })
    await expect.poll(() => uploads.length).toBe(type === 'image/jpeg' ? 1 : 2)
    await expect(page.getByText('Загружаем изображение…', { exact: true })).toHaveCount(0)
    await expectWebp(page, uploads.at(-1), 32, 16)
    if (type === 'image/webp') expect(uploads.at(-1).bytes.equals(buffer)).toBe(true)
  }
})

test('oversized and undecodable originals never reach storage', async ({ page }) => {
  const uploads = await captureUploads(page)
  const input = page.getByLabel('Изображение карты мира', { exact: true })
  await input.setInputFiles({ name: 'Большой.png', mimeType: 'image/png', buffer: Buffer.alloc(30 * 1024 * 1024 + 1) })
  await expect(page.locator('.global-map-error')).toContainText('Файл слишком большой (максимум 30 МБ)')
  await input.setInputFiles({ name: 'Сломанный.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(page.locator('.global-map-error')).toContainText('Не удалось открыть изображение')
  expect(uploads).toHaveLength(0)
})

test('a browser without a WebP encoder reports an error instead of uploading PNG', async ({ page }) => {
  const uploads = await captureUploads(page), buffer = await raster(page)
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = callback => callback(new Blob(['png'], { type: 'image/png' })) })
  await page.getByLabel('Изображение карты мира', { exact: true }).setInputFiles({ name: 'Мир.png', mimeType: 'image/png', buffer })
  await expect(page.locator('.global-map-error')).toContainText('Не удалось преобразовать изображение в WebP')
  expect(uploads).toHaveLength(0)
})
