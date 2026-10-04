import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

for (const mobile of [false, true]) test(`inventory removal and HP calculator save chronicle events on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const session = { uuid: '11111111-1111-4111-8111-111111111111', name: 'Тайны долины' }
  const char = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Лиора', hp: { current: 10, temp: 3, max: { base: 12, bonuses: [] }, hitDice: [] },
    items: { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [
      { uid: 'torch', item_id: 42, count: 3 },
    ] }] },
  }, var: {} } }
  const saves = []
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION, status: 'completed' })) }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/char/hero') json = char
    else if (path === '/api/char/hero/sessions') json = { sessions: [session] }
    else if (path.endsWith('/version')) json = { version: char.version }
    else if (path.startsWith('/api/items')) json = { items: [{ id: 42, name: 'Факел', typeId: 2, data: {} }] }
    else if (path === '/api/char/hero/data') {
      const body = request.postDataJSON()
      saves.push(body)
      char.data = body.data
      json = { version: ++char.version }
    } else if (path.endsWith('/events')) json = { events: [], updates: [] }
    else if (path === `/api/sessions/${session.uuid}`) json = { session, participants: [] }
    await route.fulfill({ json })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/char/hero')
  if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
  else await page.getByRole('tab', { name: 'Снаряжение', exact: true }).click()
  const row = page.locator('.inventory-bag-item:visible')
  async function openItem() {
    await row.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const box = await row.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  await openItem()
  await page.getByRole('menuitem', { name: 'Удалить одну', exact: true }).click()
  await expect.poll(() => saves.length).toBe(1)
  expect(saves[0].data.values.items.sections[0].items[0].count).toBe(2)
  expect(saves[0].events).toEqual([expect.objectContaining({ sessionUuid: session.uuid,
    type: 'item_removed', action: 'Удалено: Факел',
    data: { source: { itemId: 42, name: 'Факел', instanceUid: 'torch' }, itemId: 42, count: 1, remaining: 2 },
  })])
  await openItem()
  await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click()
  await expect(row).toHaveCount(0)
  await expect.poll(() => saves.length).toBe(2)
  expect(saves[1].data.values.items.sections[0].items).toEqual([])
  expect(saves[1].events).toEqual([expect.objectContaining({ type: 'item_removed',
    data: expect.objectContaining({ count: 2, remaining: 0 }),
  })])

  await page.locator('[data-tutorial="character-hp"]:visible').click()
  const editor = page.locator('[data-tutorial="character-hp-editor"]')
  await editor.getByRole('button', { name: '8', exact: true }).click()
  await editor.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect.poll(() => saves.length).toBe(3)
  expect(saves[2].data.values.hp).toMatchObject({ current: 5, temp: 0 })
  expect(saves[2].events).toEqual([expect.objectContaining({ type: 'hp_changed', action: 'Получен урон: 8',
    data: expect.objectContaining({ amount: 8, applied: 8, absorbed: 3,
      before: { current: 10, temp: 3, max: 12 }, after: { current: 5, temp: 0, max: 12 } }),
  })])
  await editor.getByRole('button', { name: '9', exact: true }).click()
  await editor.getByRole('button', { name: 'Лечение', exact: true }).click()
  await expect.poll(() => saves.length).toBe(4)
  expect(saves[3].data.values.hp).toMatchObject({ current: 12, temp: 0 })
  expect(saves[3].events).toEqual([expect.objectContaining({ type: 'hp_changed', action: 'Восстановлено хитов: 7',
    data: expect.objectContaining({ amount: 9, applied: 7, before: { current: 5, temp: 0, max: 12 }, after: { current: 12, temp: 0, max: 12 } }),
  })])
})
