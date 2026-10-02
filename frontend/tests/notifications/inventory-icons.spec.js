import { test, expect } from '@playwright/test'
import { inventoryCatalogue } from './fixtures/inventoryData.js'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlWQAAAAASUVORK5CYII='
const presets = [
  { id: 21, itemTypeId: 2, name: 'Ключ', purpose: 'item', imageUrl: `${png}#key` },
  { id: 22, itemTypeId: 2, name: 'Свиток', purpose: 'item', imageUrl: `${png}#scroll` },
  { id: 23, itemTypeId: 2, name: 'Пустая ячейка', purpose: 'empty_cell', imageUrl: `${png}#empty` },
]

for (const mobile of [false, true]) test(`simplified item icon persists and changes on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    return route.fulfill({ json: path === '/api/inventory/icon-presets' ? { presets }
      : { types: [{ id: 2, iconImageUrl: `${png}#default` }], items: inventoryCatalogue } })
  })
  await page.goto('/tests/notifications/fixtures/inventory.html')
  const bag = page.locator('[data-sortable-container="sec_bag"]')
  const add = bag.getByRole('button', { name: /Добавить предмет в ячейку/ }).first()
  await expect(add.locator('img')).toHaveAttribute('src', presets[2].imageUrl)
  await add.click()
  await page.getByRole('menuitem', { name: 'Добавить своё', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill('Ключ от башни')
  await dialog.getByRole('button', { name: 'Ключ', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Ключ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('button', { name: 'Пустая ячейка', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click()
  const entry = bag.getByRole('button', { name: 'Ключ от башни', exact: true })
  await expect(entry.locator('img')).toHaveAttribute('src', presets[0].imageUrl)
  expect(await page.evaluate(() => window.readInventory().sections[0].items.find(item => item.override?.name === 'Ключ от башни').icon_preset_id)).toBe(21)
  await page.reload()
  await expect(entry.locator('img')).toHaveAttribute('src', presets[0].imageUrl)
  await entry.click()
  await page.getByRole('menuitem', { name: 'Изменить', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Ключ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Свиток', exact: true }).click()
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(entry.locator('img')).toHaveAttribute('src', presets[1].imageUrl)
  await entry.click()
  await page.getByRole('menuitem', { name: 'Изменить', exact: true }).click()
  await dialog.getByRole('button', { name: 'По умолчанию', exact: true }).click()
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(entry.locator('img')).toHaveAttribute('src', `${png}#default`)
})
