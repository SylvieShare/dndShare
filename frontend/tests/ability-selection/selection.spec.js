import { test, expect } from '@playwright/test'
import { items, types } from './data'
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = { items: [] }
    if (path === '/api/item-types') json = { types, itemTypes: types, items: types }
    else if (path === '/api/items/by-ids') json = { items: items.filter(item => (url.searchParams.get('ids') || '').split(',').includes(String(item.id))) }
    else if (path === '/api/items' || path === '/api/items/search') {
      let found = items.filter(item => item.typeId === Number(url.searchParams.get('typeId')))
      const filters = JSON.parse(url.searchParams.get('filters') || '{}')
      if (filters.selection_parent_id) found = found.filter(item => item.data.selection_parent_id === 4069)
      const q = (url.searchParams.get('q') || '').toLowerCase()
      json = { items: found.filter(item => item.name.toLowerCase().includes(q)) }
    }
    await route.fulfill({ json })
  })
})
async function choose(page, name) {
  const back = page.getByRole('button', { name: 'К списку', exact: true })
  if (await back.isVisible()) await back.click()
  await page.getByText(name, { exact: true }).last().click()
  await page.getByRole('button', { name: '+ Добавить', exact: true }).click()
}
for (const width of [1400, 390]) {
  test(`level 2 selects two abilities, persists separate cards (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/ability-selection/fixture.html')
    await page.getByRole('button', { name: 'Повысить уровень', exact: true }).click()
    await page.getByRole('button', { name: /Колдун/ }).click()
    const panel = page.locator('[data-tutorial="ability-selection-4069"]')
    await expect(panel).toContainText('0 / 2')
    await panel.getByRole('button', { name: 'Выбрать из справочника…' }).click()
    await page.getByText('Мистическое копьё', { exact: true }).last().click()
    await expect(page.getByRole('button', { name: '+ Добавить', exact: true })).toBeDisabled()
    await choose(page, 'Доспех теней')
    await panel.getByRole('button', { name: 'Выбрать из справочника…' }).click()
    await choose(page, 'Дьявольский взгляд')
    await expect(panel).toContainText('2 / 2')
    await page.getByRole('button', { name: /Применить|Принять|Повысить до/ }).click()
    await expect.poll(() => page.evaluate(() => window.ctx.values.lvl.level)).toBe(2)
    expect(await page.evaluate(() => window.ctx.values.abilities_class.map(entry => entry.id))).toEqual([4069,9000,9001])
    await page.reload()
    await expect(page.locator('.abv-name').filter({ hasText: 'Доспех теней' })).toBeVisible()
    await expect(page.locator('.abv-name').filter({ hasText: 'Дьявольский взгляд' })).toBeVisible()
  })
  test(`level 5 offers an extra choice and one replacement (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/ability-selection/fixture.html?level=4')
    await page.getByRole('button', { name: 'Повысить уровень', exact: true }).click()
    await page.getByRole('button', { name: /Колдун/ }).click()
    const panel = page.locator('[data-tutorial="ability-selection-4069"]')
    await expect(panel).toContainText('2 / 3')
    await expect(panel.getByRole('button', { name: 'Заменить', exact: true })).toHaveCount(2)
    await panel.getByRole('button', { name: 'Заменить', exact: true }).first().click()
    await choose(page, 'Звериная речь')
    await expect(panel.getByRole('button', { name: 'Заменить', exact: true })).toBeDisabled()
    await panel.getByRole('button', { name: 'Сбросить изменения' }).click()
    await expect(panel).toContainText('Заменено: 0')
  })
}

for (const width of [1400, 390]) test(`existing sheet fills missing choices without levelling (${width})`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/tests/ability-selection/fixture.html?level=2&empty')
  await page.locator('.abv-card').filter({ hasText: 'Таинственные воззвания' }).click()
  await page.getByRole('menuitem', { name: 'Выбрать способности' }).click()
  const panel = page.locator('[data-tutorial="ability-selection-4069"]')
  for (const name of ['Доспех теней', 'Звериная речь']) {
    await panel.getByRole('button', { name: 'Выбрать из справочника…' }).click()
    await choose(page, name)
  }
  await page.getByRole('button', { name: 'Сохранить выбор', exact: true }).click()
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => window.ctx.values.lvl.level)).toBe(2)
  expect(await page.evaluate(() => window.ctx.values.abilities_class.map(entry => entry.id))).toEqual([4069,9000,9002])
})
test('reader cannot edit invocation selections', async ({ page }) => {
  await page.goto('/tests/ability-selection/fixture.html?level=2&reader')
  await page.locator('.abv-card').filter({ hasText: 'Таинственные воззвания' }).click()
  await expect(page.getByRole('menuitem', { name: 'Выбрать способности' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Удалить' })).toHaveCount(0)
})
