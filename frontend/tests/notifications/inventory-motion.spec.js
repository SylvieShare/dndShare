import { test, expect } from '@playwright/test'
import { inventoryCatalogue, inventoryTypes } from './fixtures/inventoryData'

async function openInventory(page, { mobile = false, reduced = false, sparse = false, dragDuringRemoval = false } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 })
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/')
    ? route.fulfill({ json: { types: inventoryTypes, items: inventoryCatalogue } }) : route.continue())
  await page.addInitScript(({ sparse, dragDuringRemoval }) => {
    window.inventoryMotionCalls = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const result = animate.apply(this, args)
      queueMicrotask(() => window.inventoryMotionCalls.push(result.id))
      return result
    }
    if (sparse) localStorage.setItem('test-inventory', JSON.stringify({ equipped: [], sections: [{ id: 'bag', name: 'Рюкзак',
      slots: { last: 8, rope: 0 }, items: [
        { uid: 'last', count: 1, item_id: null, override: { name: 'Мел' } },
        ...(dragDuringRemoval ? [{ uid: 'rope', count: 2, item_id: null, override: { name: 'Верёвка' } }] : []),
      ] }] }))
  }, { sparse, dragDuringRemoval })
  await page.goto('/tests/notifications/fixtures/inventory.html')
  await expect(page.locator('[data-sortable-container="sec_bag"] .inventory-bag-item').first()).toBeVisible()
}

async function action(page, name, label) {
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('menuitem', { name: label, exact: true }).click()
}
const motions = page => page.evaluate(() => window.inventoryMotionCalls)

for (const mobile of [false, true]) test(`inventory add and remove animations on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await openInventory(page, { mobile })
  expect(await motions(page)).toEqual([])
  await action(page, 'Верёвка', 'Добавить +1')
  await expect.poll(() => motions(page)).toContain('inventory-add-one')
  await expect(page.getByRole('button', { name: 'Верёвка', exact: true })).toHaveAttribute('aria-description', 'Упрощённый предмет. Количество: 3')
  await action(page, 'Верёвка', 'Удалить одну')
  await expect.poll(() => motions(page)).toContain('inventory-remove-one')
  await action(page, 'Верёвка', 'Удалить одну')
  await expect(page.getByRole('button', { name: 'Верёвка', exact: true }).locator('.inventory-bag-item__count')).toHaveCount(0)
  await action(page, 'Верёвка', 'Удалить')
  await expect.poll(() => motions(page)).toContain('inventory-remove-item')
  await expect(page.getByRole('button', { name: 'Верёвка', exact: true })).toHaveCount(0)
  await expect(page.locator('.inventory-bag-effects > *')).toHaveCount(0)
  const bag = page.locator('[data-sortable-container="sec_bag"]')
  await bag.getByRole('button', { name: /Добавить предмет в ячейку/ }).first().click()
  await page.getByRole('menuitem', { name: 'Добавить своё', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Новый предмет', exact: true })
  await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill('Новая верёвка')
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect.poll(() => motions(page)).toContain('inventory-add-item')
  await expect(page.getByRole('button', { name: 'Новая верёвка', exact: true })).toBeVisible()
})

test('last item disappears without leaving a draggable ghost or retained row', async ({ page }) => {
  await openInventory(page, { sparse: true, mobile: true })
  const bag = page.locator('[data-sortable-container="sec_bag"]')
  await expect(bag.locator('.inventory-bag-cell')).toHaveCount(12)
  await action(page, 'Мел', 'Удалить')
  await expect.poll(() => motions(page)).toContain('inventory-remove-item')
  await expect(bag.locator('.inventory-bag-effects [data-sortable-key]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Мел', exact: true })).toHaveCount(0)
  await expect(bag.locator('.inventory-bag-effects > *')).toHaveCount(0)
  await expect(bag.locator('.inventory-bag-cell')).toHaveCount(4)
  expect((await page.evaluate(() => window.readInventory())).sections[0].items).toEqual([])
})

test('reduced motion applies changes immediately without animation', async ({ page }) => {
  await openInventory(page, { reduced: true })
  await action(page, 'Верёвка', 'Добавить +1')
  await action(page, 'Верёвка', 'Удалить одну')
  await action(page, 'Верёвка', 'Удалить')
  expect((await page.evaluate(() => window.readInventory())).sections[0].items.map(item => item.uid)).not.toContain('a')
  expect(await motions(page)).toEqual([])
  await expect(page.locator('.inventory-bag-effects > *')).toHaveCount(0)
})

test('rapid additions and removals settle on the real quantity', async ({ page }) => {
  await openInventory(page)
  for (let index = 0; index < 3; index++) {
    await action(page, 'Верёвка', 'Добавить +1')
    await action(page, 'Верёвка', 'Удалить одну')
  }
  await expect(page.locator('.inventory-bag-item__feedback')).toHaveCount(0)
  const entry = (await page.evaluate(() => window.readInventory())).sections[0].items.find(item => item.uid === 'a')
  expect(entry.count).toBe(2)
  expect((await motions(page)).filter(id => id === 'inventory-remove-item')).toEqual([])
})

test('changing reduced-motion preference cancels an active removal', async ({ page }) => {
  await openInventory(page, { sparse: true })
  await action(page, 'Мел', 'Удалить')
  await expect.poll(() => motions(page)).toContain('inventory-remove-item')
  await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'inventory-remove-item').forEach(animation => animation.pause()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.inventory-bag-effects > *')).toHaveCount(0)
  expect(await page.evaluate(() => document.getAnimations().some(animation => animation.id === 'inventory-remove-item'))).toBe(false)
})

test('a fading last row stays usable until an active drag ends', async ({ page }) => {
  await openInventory(page, { sparse: true, dragDuringRemoval: true, mobile: true })
  const bag = page.locator('[data-sortable-container="sec_bag"]')
  await action(page, 'Мел', 'Удалить')
  await expect.poll(() => motions(page)).toContain('inventory-remove-item')
  await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'inventory-remove-item').forEach(animation => animation.pause()))
  const source = await bag.getByRole('button', { name: 'Верёвка', exact: true }).boundingBox()
  const target = await bag.locator('[data-sortable-slot="8"]').boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'inventory-remove-item').forEach(animation => animation.finish()))
  await expect(bag.locator('.inventory-bag-effects > *')).toHaveCount(0)
  await expect(bag.locator('.inventory-bag-cell')).toHaveCount(12)
  await page.mouse.up()
  expect((await page.evaluate(() => window.readInventory())).sections[0].slots.rope).toBe(8)
  expect((await motions(page)).filter(id => id === 'inventory-add-item')).toEqual([])
})

test('moving and equipping an instance does not animate addition or removal', async ({ page }) => {
  await openInventory(page)
  await action(page, 'Кожаный доспех', 'Экипировать')
  expect(await motions(page)).toEqual([])
  const source = await page.getByRole('button', { name: 'Верёвка', exact: true }).boundingBox()
  const target = await page.locator('[data-sortable-container="sec_chest"] [data-sortable-slot="2"]').boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('[data-sortable-container="sec_chest"]').getByRole('button', { name: 'Верёвка', exact: true })).toBeVisible()
  expect(await motions(page)).toEqual([])
})
