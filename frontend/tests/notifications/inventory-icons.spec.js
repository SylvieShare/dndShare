import { test, expect } from '@playwright/test'
import { inventoryCatalogue } from './fixtures/inventoryData.js'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlWQAAAAASUVORK5CYII='
const presets = [
  { id: 21, itemTypeId: 2, name: 'Ключ', purpose: 'item', imageUrl: `${png}#key` },
  { id: 22, itemTypeId: 2, name: 'Свиток', purpose: 'item', imageUrl: `${png}#scroll` },
  { id: 23, itemTypeId: 2, name: 'Пустая ячейка', purpose: 'empty_cell', imageUrl: `${png}#empty` },
  { id: 24, itemTypeId: 2, name: 'Одежда', purpose: 'item', imageUrl: `${png}#clothing` },
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
  await expect(dialog.getByRole('button', { name: 'Одежда', exact: true })).toBeVisible()
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

for (const mobile of [false, true]) for (const viewer of [false, true]) test(`inventory cell chips on ${mobile ? 'mobile' : 'desktop'} for ${viewer ? 'reader' : 'owner'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 })
  const item = { id: 135, typeId: 19, name: 'Лечащий плащ', data: { activation: 'equipped', attunement: 'none', usable: { choices: [] } }, iconImageUrl: png }
  await page.addInitScript(model => localStorage.setItem('test-inventory', JSON.stringify(model)), {
    equipped: [{ uid: 'custom-worn', item_id: null, count: 1, override: { name: 'Самодельный пояс' } }], sections: [{ id: 'bag', name: 'Рюкзак', items: [
      { uid: 'cloak', item_id: 135, count: 9999, params: {} },
      { uid: 'custom', item_id: null, count: 2, icon_preset_id: 24, override: { name: 'Дорожная одежда' } },
      { uid: 'expired', item_id: 135, count: 1, params: { creation: { expired: true } }, override: { name: 'Просроченный плащ' } },
    ] }],
  })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    return route.fulfill({ json: path === '/api/inventory/icon-presets' ? { presets } : { types: [{ id: 2 }], items: [item] } })
  })
  await page.goto(`/tests/notifications/fixtures/inventory.html${viewer ? '?viewer' : ''}`)
  const bag = page.locator('[data-sortable-container="sec_bag"]')
  await expect(bag).toBeVisible()
  await bag.evaluate(element => { element.style.width = '312px' })
  await expect(bag).toHaveCSS('grid-template-columns', '72px 72px 72px 72px')
  const cloak = bag.getByRole('button', { name: 'Лечащий плащ', exact: true })
  await expect(cloak.getByTitle('Можно надеть', { exact: true })).toBeVisible()
  await expect(cloak.getByTitle('Можно использовать', { exact: true })).toBeVisible()
  await expect(cloak).toHaveAttribute('aria-description', 'Можно надеть. Можно использовать. Количество: 9999')
  await expect(cloak.getByTitle('Упрощённый предмет')).toHaveCount(0)
  const custom = bag.getByRole('button', { name: 'Дорожная одежда', exact: true })
  await expect(custom.getByTitle('Упрощённый предмет')).toHaveCount(0)
  const customCell = bag.locator('.inventory-bag-cell').filter({ has: page.getByRole('button', { name: 'Дорожная одежда', exact: true }) })
  await expect(customCell).toHaveClass(/inventory-bag-cell--simplified/)
  expect(await customCell.evaluate(element => getComputedStyle(element, '::after').borderTopStyle)).toBe('dashed')
  const regularCell = bag.locator('.inventory-bag-cell').filter({ has: page.getByRole('button', { name: 'Лечащий плащ', exact: true }) })
  const border = cell => cell.evaluate(element => {
    const css = getComputedStyle(element, '::after')
    return { width: css.borderTopWidth, color: css.borderTopColor }
  })
  const regularBorder = await border(regularCell)
  expect(regularBorder.width).toBe('2px')
  expect(await border(customCell)).toEqual(regularBorder)
  expect(await border(bag.locator('.inventory-bag-cell').last())).toEqual(regularBorder)
  await expect(custom).toHaveAttribute('aria-description', 'Упрощённый предмет. Количество: 2')
  const customWorn = bag.getByRole('button', { name: 'Самодельный пояс', exact: true })
  await expect(customWorn).toHaveAttribute('aria-description', 'Упрощённый предмет. Экипировано')
  const wornCell = bag.locator('.inventory-bag-cell').filter({ has: page.getByRole('button', { name: 'Самодельный пояс', exact: true }) })
  await expect(wornCell).toHaveClass(/inventory-bag-cell--equipped/)
  expect(await wornCell.evaluate(element => getComputedStyle(element, '::after').borderTopStyle)).toBe('dashed')
  expect(await wornCell.evaluate(element => getComputedStyle(element, '::after').borderTopWidth)).toBe('2px')
  await expect(custom.locator('.inventory-bag-item__tags')).toHaveCount(0)
  await expect(bag.getByRole('button', { name: 'Просроченный плащ', exact: true }).getByTitle('Можно использовать')).toHaveCount(0)
  const geometry = await cloak.evaluate(element => {
    const cell = element.getBoundingClientRect()
    const count = element.querySelector('.inventory-bag-item__count'), tags = element.querySelector('.inventory-bag-item__tags')
    const qty = count.getBoundingClientRect(), capabilities = tags.getBoundingClientRect(), css = getComputedStyle(count)
    return { right: cell.right - qty.right, bottom: cell.bottom - qty.bottom, left: capabilities.left - cell.left, gap: qty.left - capabilities.right,
      topLeft: parseFloat(css.borderTopLeftRadius), topRight: parseFloat(css.borderTopRightRadius), bottomLeft: parseFloat(css.borderBottomLeftRadius), bottomRight: parseFloat(css.borderBottomRightRadius) }
  })
  expect(Math.abs(geometry.right)).toBeLessThan(1)
  expect(Math.abs(geometry.bottom)).toBeLessThan(1)
  expect(Math.abs(geometry.left)).toBeLessThan(1)
  expect(geometry.gap).toBeGreaterThanOrEqual(3)
  expect(geometry.topLeft).toBeGreaterThan(0)
  expect(geometry.bottomRight).toBeGreaterThan(0)
  expect(geometry.topRight).toBe(0)
  expect(geometry.bottomLeft).toBe(0)
  if (!viewer) {
    await cloak.click()
    await page.getByRole('menuitem', { name: 'Экипировать', exact: true }).click()
    await expect(cloak.getByTitle('Надето', { exact: true })).toBeVisible()
    await expect(cloak).toHaveAttribute('aria-description', 'Экипировано. Можно использовать. Количество: 9999')
  }
})
