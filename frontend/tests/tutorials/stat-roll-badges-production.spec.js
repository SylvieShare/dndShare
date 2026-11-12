import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

for (const width of [390, 834, 1440]) test(`stat dice badges, cached icons and edit order work in the app at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  api.document().values.abilities_class = [{ id: 777 }]
  await page.route('**/api/items/by-ids?**', route => {
    const ids = new URL(route.request().url()).searchParams.get('ids').split(',').map(Number)
    return route.fulfill({ json: { items: ids.map(id => ({ id, typeId: id === 777 ? 5 : 1, name: id === 777 ? 'Режимы характеристик' : 'Предмет', data: id === 777 ? { derived_effects: [
      { kind: 'roll_mode', mode: 'advantage', scopes: ['ability_check'], ability_ids: [1] },
      { kind: 'roll_mode', mode: 'disadvantage', scopes: ['ability_check'], ability_ids: [2] },
    ] } : {} })) } })
  })
  const suggests = {
    16: ['Сила', 'Ловкость', 'Выносливость', 'Интеллект', 'Мудрость', 'Харизма'].map((value, index) => ({ id: index + 1, value, svgId: 901 + index })),
    15: [],
  }
  await page.route('**/api/suggest/batch?**', route => route.fulfill({ json: { items: suggests } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests, suggestTypes: [], books: [] } } }))
  await page.route('**/api/svg/*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>' }))
  await page.goto('/char/test')
  const strength = page.getByRole('button', { name: 'Сила — проверка', exact: true })
  const dexterity = page.getByRole('button', { name: 'Ловкость — проверка', exact: true })
  await expect(strength.locator('.roll-badge__die--discarded')).toHaveAttribute('data-roll-value', '1')
  await expect(dexterity.locator('.roll-badge__die--discarded')).toHaveAttribute('data-roll-value', '20')
  await expect.poll(() => strength.locator('.stat-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  await expect.poll(() => page.locator('.stat-icon').evaluateAll(nodes => nodes.filter(node => node.style.maskImage.includes('blob:')).length)).toBe(6)
  await expect(strength.locator('.system-die__value')).toHaveText(['1', '20'])
  await page.locator('[data-sheet-field="STR"]').screenshot({ path: testInfo.outputPath('stat-dice-badge.png') })
  await strength.click()
  const menu = page.getByRole('menu', { name: 'Сила — проверка', exact: true })
  const edit = menu.getByRole('menuitem', { name: 'Изменить', exact: true })
  expect((await edit.boundingBox()).y).toBeLessThan((await menu.getByText('Режим броска', { exact: true }).boundingBox()).y)
  await edit.click()
  await expect(page.getByRole('dialog', { name: 'Сила', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
