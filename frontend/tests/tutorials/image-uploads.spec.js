import { test, expect } from '@playwright/test'
import { captureUploads, expectWebp, raster } from '../image-uploads/helpers'

test('mobile creation crops and converts an icon through the shared image pipeline', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/tutorials/fixtures/media.html')
  const uploads = await captureUploads(page)
  const buffer = await raster(page, 'image/jpeg', 600, 800)
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'Герой.jpg', mimeType: 'image/jpeg', buffer })
  await expect(page.locator('.avatar-crop-stage img')).toBeVisible()
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect.poll(() => uploads.length).toBe(1)
  await expectWebp(page, uploads[0], 256, 256)
})
