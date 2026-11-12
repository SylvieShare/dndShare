import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

const photoUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240"><rect width="180" height="240" fill="#35313f"/><circle cx="90" cy="85" r="43" fill="#b79cec"/><path d="M20 240a70 90 0 01140 0" fill="#766098"/></svg>')
async function open(page, width, owner = true) {
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page, 'DND5', owner)
  api.document().values.person_photos = Array.from({ length: 7 }, (_, index) => ({ uid: `photo-${index}`, imageId: index + 1, url: photoUrl, name: `Фото ${index + 1}` }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  await page.route('**/api/storage/images', route => route.fulfill({ json: { upload_id: 801, url: photoUrl, key: 'gallery-photo.webp' } }))
  await page.goto('/char/test')
  await page.getByRole(width >= 1200 ? 'tab' : 'button', { name: 'Личность', exact: true }).click()
  if (width < 1200) await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  return api
}

for (const width of [390, 834, 1440]) test(`gallery scrolls horizontally, opens fullscreen and persists uploads/deletion at ${width}`, async ({ page }) => {
  const api = await open(page, width)
  const gallery = page.locator('[data-sheet-field="person_photos"]:visible')
  const strip = gallery.locator('.photo-strip')
  const layout = await gallery.evaluate(field => {
    const tile = field.closest('.person-group')
    const sheet = tile.parentElement
    const appearance = sheet.querySelector('[data-sheet-field="person_appearance"]').closest('.person-group')
    return {
      separate: appearance !== tile,
      belowAppearance: tile.getBoundingClientRect().top >= appearance.getBoundingClientRect().bottom,
      columns: new Set([...sheet.children].map(block => Math.round(block.getBoundingClientRect().left))).size,
    }
  })
  expect(layout.separate).toBe(true)
  expect(layout.belowAppearance).toBe(true)
  if (width >= 600 && width < 1200) expect(layout.columns).toBe(1)
  expect(await strip.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await gallery.getByRole('button', { name: 'Фотография 1', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Посмотреть', exact: true }).click()
  const viewer = page.getByRole('dialog', { name: 'Фотография персонажа', exact: true })
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('img')).toHaveAttribute('src', photoUrl)
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
  await gallery.getByRole('button', { name: 'Фотография 1', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click()
  await page.getByRole('dialog', { name: 'Удалить фотографию?', exact: true }).getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect.poll(() => api.document().values.person_photos.length).toBe(6)
  await gallery.locator('input[type=file]').setInputFiles({ name: 'portrait.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect width="160" height="240" fill="#b79cec"/></svg>') })
  await expect.poll(() => api.document().values.person_photos.at(-1)?.imageId).toBe(801)
  expect(await strip.evaluate(element => element.lastElementChild.textContent.trim())).toBe('Добавить')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: `target/gallery-${width}.png` })
})

test('read-only galleries expose viewing without upload or removal', async ({ page }) => {
  const api = await open(page, 390, false)
  const gallery = page.locator('[data-sheet-field="person_photos"]:visible')
  await expect(gallery.getByRole('button', { name: 'Добавить', exact: true })).toHaveCount(0)
  await gallery.getByRole('button', { name: 'Фотография 1', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Посмотреть', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Удалить', exact: true })).toHaveCount(0)
  expect(api.writes).toEqual([])
})
