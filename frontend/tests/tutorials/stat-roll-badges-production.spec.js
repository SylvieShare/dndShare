import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

for (const width of [390, 834, 1440]) test(`stat dice badges, dictionary raster icons and edit order work in the app at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  api.document().values.abilities_class = [{ id: 777 }]
  await page.route('**/api/items/by-ids?**', route => {
    const ids = new URL(route.request().url()).searchParams.get('ids').split(',').map(Number)
    return route.fulfill({ json: { items: ids.map(id => ({ id, typeId: id === 777 ? 5 : 1, iconSvgId: id === 777 ? 920 : null, name: id === 777 ? 'Режимы характеристик' : 'Предмет', data: id === 777 ? { derived_effects: [
      { kind: 'roll_mode', mode: 'advantage', scopes: ['ability_check'], ability_ids: [1] },
      { kind: 'roll_mode', mode: 'disadvantage', scopes: ['ability_check'], ability_ids: [2] },
      { kind: 'roll_bonus', formula: '1d4', scopes: ['ability_check'] },
    ] } : {} })) } })
  })
  const raster = await page.evaluate(() => { const canvas=document.createElement('canvas');canvas.width=canvas.height=8;canvas.getContext('2d').fillRect(0,0,8,8);return canvas.toDataURL('image/webp') })
  const suggests = {
    16: ['Сила', 'Ловкость', 'Выносливость', 'Интеллект', 'Мудрость', 'Харизма'].map((value, index) => ({ id: index + 1, value, svgId: 901 + index, iconImageUrl:raster })),
    15: [],
  }
  await page.route('**/api/suggest/batch?**', route => route.fulfill({ json: { items: suggests } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests, suggestTypes: [], books: [] } } }))
  await page.route('**/api/svg/*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>' }))
  await page.goto('/char/test')
  const strength = page.getByRole('button', { name: 'Сила — проверка', exact: true })
  const dexterity = page.getByRole('button', { name: 'Ловкость — проверка', exact: true })
  await expect(strength).toBeVisible({ timeout: 15000 })
  await expect(strength.locator('.roll-badge__die--discarded')).toHaveAttribute('data-roll-value', '1')
  await expect(dexterity.locator('.roll-badge__die--discarded')).toHaveAttribute('data-roll-value', '20')
  await expect.poll(() => page.locator('.stat-icon img').evaluateAll(nodes => nodes.filter(node => node.complete && node.naturalWidth===8).length)).toBe(6)
  await expect(page.locator('.stat-icon .svg-icon')).toHaveCount(0)
  await expect(strength.locator('.system-die__value')).toHaveText(['1', '20'])
  const valueHeight = await strength.locator('.stat-mod').evaluate(el => el.clientHeight)
  expect(await strength.locator('.stat-roll-value').evaluate(el => el.clientHeight)).toBeLessThanOrEqual(valueHeight + 25)
  expect(await strength.locator('.roll-badge').evaluate(el => el.clientHeight)).toBeLessThanOrEqual(24)
  await page.locator('[data-sheet-field="STR"]').screenshot({ path: testInfo.outputPath('stat-dice-badge.png') })
  await page.screenshot({ path: testInfo.outputPath('stats-layout.png') })
  await strength.click()
  const menu = page.getByRole('menu', { name: 'Сила — проверка', exact: true })
  await expect(menu).toHaveCSS('transform', 'none')
  const edit = menu.getByRole('menuitem', { name: 'Изменить', exact: true })
  await expect(page.locator('.stat-roll-value--active')).toHaveCount(1)
  await expect(strength.locator('.stat-roll-value')).toHaveClass(/stat-roll-value--active/)
  await expect(page.locator('[data-sheet-field="STR"] .stat-view')).not.toHaveClass(/action-menu-source--open/)
  await expect(menu.getByText(/Меньший из|Больший из/)).toHaveCount(0)
  for (const mode of ['Помеха', 'Преимущество']) {
    const option = menu.getByRole('button', { name: mode, exact: true })
    await expect(option).toHaveClass(/share-choice-card--tinted/)
    expect((await option.boundingBox()).height).toBeGreaterThanOrEqual(72)
    expect((await option.boundingBox()).height).toBeLessThanOrEqual(74)
    await expect(option.locator('.share-choice-card__check')).toHaveCount(0)
    await expect(option.locator('.share-choice-card__label')).toHaveCSS('font-size', '16px')
  }
  await expect(menu.getByRole('button', { name: 'Преимущество', exact: true })).toHaveCSS('box-shadow', /inset/)
  await expect(menu.getByRole('button', { name: 'Помеха', exact: true })).toHaveCSS('box-shadow', 'none')
  await expect(strength.locator('[data-stat-roll-number]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(menu.getByRole('button', { name: 'Преимущество', exact: true }).locator('.roll-badge--large .system-die')).toHaveCount(2)
  const bonus = menu.getByRole('switch', { name: 'Режимы характеристик', exact: true })
  await expect.poll(() => bonus.locator('.item-icon .svg-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  await bonus.locator('.roll-bonus-option__name').click()
  await expect(bonus).toHaveAttribute('aria-checked', 'false')
  expect((await edit.boundingBox()).y).toBeLessThan((await menu.getByText('Режим броска', { exact: true }).boundingBox()).y)
  await edit.click()
  await expect(page.getByRole('dialog', { name: 'Сила', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
