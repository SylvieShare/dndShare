import { test, expect } from '@playwright/test'
import { captureUploads, expectWebp, raster } from './helpers'

async function openCharacter(page) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let json = {}
    if (path === '/api/user/checkAuth') json = { auth: true, user: { id: 1, roles: [], login: 'Игрок' } }
    else if (path === '/api/char/test') json = route.request().method() === 'PATCH'
      ? { version: 2, patches: route.request().postDataJSON().patches }
      : { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
        name: 'Торин', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
        STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
      }, var: { stats: {} } } }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/account/tutorials') json = { tutorials: ['mobile', 'desktop'].map(device => ({ flowId: 'character', sourceKey: 'edition:1', device, status: 'completed', revision: 1 })) }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    await route.fulfill({ json })
  })
  await page.goto('/char/test')
  await expect(page.locator('.view')).toContainText('Торин')
  await expect(page.locator('.guided-tour__card')).toHaveCount(0)
}

test('character icon converts JPEG to WebP in the sheet', async ({ page }) => {
  await openCharacter(page)
  const uploads = await captureUploads(page, '**/api/char/test/icon-image')
  const buffer = await raster(page, 'image/jpeg', 128, 128)
  const input = page.locator('.dci-icon-wrap input[type=file]')
  await input.setInputFiles({ name: 'Торин.jpg', mimeType: 'image/jpeg', buffer })
  await expect.poll(() => uploads.length).toBe(1)
  await expectWebp(page, uploads[0], 128, 128)
})

test('portrait keeps cropping and uploads WebP', async ({ page }) => {
  await openCharacter(page)
  const uploads = await captureUploads(page)
  const buffer = await raster(page, 'image/png', 600, 800)
  await page.getByRole('tab', { name: 'Личность', exact: true }).click()
  await page.locator('.avatar input[type=file]').first().setInputFiles({ name: 'Портрет.png', mimeType: 'image/png', buffer })
  await expect(page.locator('.avatar-crop-stage img')).toBeVisible()
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect.poll(() => uploads.length).toBe(1)
  expect(uploads[0].type).toBe('image/webp')
  expect(uploads[0].bytes.subarray(8, 12).toString()).toBe('WEBP')
  await expect(page.locator('.avatar img.avatar-img')).toBeVisible()
})
