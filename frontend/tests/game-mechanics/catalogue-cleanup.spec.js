import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('у зелья доступно применение, а у своего предмета можно изменить расходуемость', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  const items = [{ id: 84, typeId: 10, name: 'Зелье лечения', data: { usable: { healing: '2d4+2' } } },
    { id: 42, typeId: 2, name: 'Факел', data: {} }]
  const entries = [{ uid: 'dose', count: 2, item_id: 84, override: { consumable: false } }, { uid: 'torch', count: 1, item_id: null, override: { name: 'Факел' } }]
  await page.addInitScript(rows => {
    if (!localStorage.getItem('test-inventory')) localStorage.setItem('test-inventory', JSON.stringify({
      equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: rows }],
    }))
  }, entries)
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: {
    types: [{ id: 2, name: 'Предметы' }, { id: 10, name: 'Зелья', parentTypeId: 2 }], items,
  } }))
  await page.goto('/tests/notifications/fixtures/inventory.html')
  async function edit(name) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Изменить', exact: true }).click()
    return page.getByRole('dialog')
  }
  await page.getByRole('button', { name: 'Зелье лечения', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /Использовать на/ })).toBeVisible()
  await expect(page.getByRole('menu').getByText('Расходуемое', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  const torch = await edit('Факел')
  const flag = torch.getByRole('switch', { name: 'Расходуемое' })
  await expect(flag).not.toBeChecked()
  await flag.click()
  await torch.getByRole('button', { name: 'Сохранить' }).click()
  expect(await page.evaluate(() => window.readInventory().sections[0].items[1].override.consumable)).toBe(true)
})

test('печатный лист показывает правило большого круга один раз, в том числе со старым ответом справочника', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  const reviewed = JSON.parse(readFileSync(new URL('../../../scripts/mechanics/catalogue-cleanup/reviewed_spells.json', import.meta.url), 'utf8'))
  const names = { 736: 'Звукосотрясение', 1251: 'Пляшущая молния', 1254: 'Полное исцеление', 1259: 'Призыв духа исчадия' }
  const spells = Object.entries(reviewed).map(([id, rule]) => ({
    id: Number(id), typeId: 5, name: names[id], data: { lvl: Number(id) === 736 ? 2 : 6, description: rule.paragraph, upper: rule.legacy },
  }))
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/char/print-test') return route.fulfill({ json: { templateName: 'DND5', sourceVersion: '2014', userId: 1,
      data: { values: { name: 'Маг', spells: { tabs: [{ key: 'wizard', title: 'Волшебник', spells: spells.map(s => ({ id: s.id, key: String(s.id) })) }] } } } } })
    if (path === '/api/items/by-ids') return route.fulfill({ json: { items: spells } })
    return route.fulfill({ json: { items: {}, types: [] } })
  })
  await page.emulateMedia({ media: 'print' })
  await page.goto('/char/print-test/print')
  for (const spell of spells) {
    const card = page.locator('article.spell-card').filter({ has: page.getByRole('heading', { name: spell.name, exact: true }) })
    await expect(card).toBeVisible()
    await expect(card.locator('p').filter({ hasText: 'На больших кругах.' })).toHaveCount(1)
    await expect(card).not.toContainText('На более высоких уровнях')
  }
})
