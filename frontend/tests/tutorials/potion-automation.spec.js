import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) test(`potion self-use applies healing and effect on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const potion = { id: 84, name: 'Зелье героического лечения', typeId: 10, data: { consumption: { healing: '2d4 + 2' } } }
  const effect = { id: 100, name: 'Благословение', typeId: 15, data: { desc: 'Кость к атакам и спасброскам', duration: { kind: 'hours', value: 1 } } }
  const char = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Лиора', hp: { current: 2, max: { base: 12, bonuses: [] }, hitDice: [] },
    potions: [{ uid: 'dose', item_id: 84, count: 2 }], items: { equipped: [], sections: [] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: {} } }
  const requests = []
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: 1, status: 'completed' })) }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/char/hero') json = char
    else if (path.endsWith('/sessions')) json = { sessions: [] }
    else if (path.endsWith('/version')) json = { version: char.version }
    else if (path.startsWith('/api/items')) json = { items: [potion, effect] }
    else if (path.endsWith('/data')) { const body = request.postDataJSON(); char.data = body.data; char.version++; json = { version: char.version } }
    else if (path.endsWith('/potion-use')) {
      requests.push(request.postDataJSON())
      char.version++; char.data.values.potions[0].count--; char.data.values.hp.current = 10
      char.data.values.states = [{ uid: 'applied', effect_id: 100, duration: { kind: 'hours', value: 1 }, concentration: false, source: { kind: 'potion', item_id: 84 } }]
      json = { result: { healing: { formula: '2d4 + 2', dice: [3, 3], total: 8, applied: 8 }, effects: [{ id: 100, name: 'Благословение', duration: { kind: 'hours', value: 1 }, concentration: false }] } }
    }
    await route.fulfill({ json })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/char/hero')
  if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
  else await page.getByRole('tab', { name: 'Снаряжение', exact: true }).click()
  const row = page.locator('.ps-glasswrap:visible')
  await row.scrollIntoViewIfNeeded()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const box = await row.boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.getByRole('menuitem', { name: 'Использовать на себя', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Применено: Зелье героического лечения' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Восстановлено хитов: 8')
  await expect(dialog).toContainText('Благословение')
  await expect(dialog).toContainText('1 час')
  await expect(dialog.locator('.dice-roll-result')).toContainText('= 8')
  expect(requests).toHaveLength(1)
  expect(requests[0].entryUid).toBe('dose')
  expect(char.data.values.hp.current).toBe(10)
  expect(char.data.values.potions[0].count).toBe(1)
})
