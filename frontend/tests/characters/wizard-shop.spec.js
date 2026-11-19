import { test, expect } from '@playwright/test'

const icon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>'
const rope = { id: 901, name: 'Верёвка', typeId: 2, iconImageUrl: icon, data: { available_in_starting_shop: true, cost: { value: 1, suggest_id: 3 } } }
for (const width of [390, 840, 1440]) {
  test('D&D shop, dice and cart at ' + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 920 })
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url())
      const catalogues = { 2: [rope], 9: [{ id: 12, typeId: 9, name: 'Воин', data: {} }] }
      const responses = {
        '/api/sources': { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] },
        '/api/item-types': { types: [{id:2, name:'Снаряжение', iconImageUrl:icon}] },
        '/api/templates': { templates: [{ id: 1, name: 'DND5' }] },
        '/api/items': { items: catalogues[url.searchParams.get('typeId')] || [] },
        '/api/suggest/batch': { items: {} },
      }
      return route.fulfill({ json: responses[url.pathname] || { items: [] } })
    })
    await page.addInitScript(() => {
      const key = 'dnd-create-wizard-v2'
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
        step: 5, flowVersion: 4, version: '2014', charClass: { id: 12, name: 'Воин', data: {} },
        buyStartingEquipment: true, startingWealthRoll: { gold: 125, rolls: [], multiplier: 1 },
      }))
    })
    await page.goto('/chars/new?system=dnd5e')
    const shop = page.locator('.wizard-shop')
    const categories = shop.getByRole('group', { name: 'Категории магазина' })
    await expect(categories.getByRole('button')).toHaveCount(1)
    await expect(categories.locator('img')).toHaveAttribute('src',icon)
    await expect(page.locator('.cc-main')).toHaveCSS('border-left-width', width <= 640 ? '0px' : '1px')
    const catalogue = await shop.locator('.catalogue').boundingBox()
    const summary = await shop.locator('.shop-summary').boundingBox()
    if (width === 390) expect(summary.y).toBeGreaterThan(catalogue.y)
    else expect(summary.x).toBeGreaterThanOrEqual(catalogue.x + catalogue.width)
    await shop.locator('.shop-add').click()
    await expect(shop.locator('.cart-name img')).toBeVisible()
    await info.attach('shop-' + width, { body: await page.screenshot(), contentType: 'image/png' })
    await shop.getByRole('radio', { name: 'Бросок' }).click()
    await page.getByRole('button', { name: 'Отмена', exact: true }).last().click()
    await expect(shop.locator('.cart-item')).toHaveCount(1)
    await shop.getByRole('radio', { name: 'Бросок' }).click()
    await page.getByRole('button', { name: 'Изменить', exact: true }).click()
    await expect(shop.locator('.system-die')).toHaveCount(5)
    await expect(shop.locator('.cart-item')).toHaveCount(0)
    await shop.getByRole('radio', { name: 'По умолчанию' }).click()
    await expect(shop.locator('.wealth-copy strong')).toHaveText('125 зм')
  })
}
