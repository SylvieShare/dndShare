import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) test(`item transfer request, refusal and acceptance on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const item = { uid: 'rope', item_id: null, count: 3, override: { name: 'Шёлковая верёвка', desc: 'Особая верёвка' }, params: {} }
  const character = (name, items) => ({ templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name, hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    items: { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items }] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } })
  const chars = { sender: character('Лиора', [item]), recipient: character('Торин', []) }
  const session = { uuid: 'campaign', name: 'Тайны долины' }
  let transfers = [], nextId = 1
  const requests = []
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const parts = path.split('/'), char = chars[parts[3]]
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: 1, status: 'completed' })) }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/sessions/campaign') json = { session, participants: Object.entries(chars).map(([charUuid, c]) => ({ charUuid, templateId: 1, data: c.data, iconImageUrl: '/static/tab-stats.svg' })) }
    else if (char && parts.length === 4) json = char
    else if (char && parts[4] === 'sessions') json = { sessions: [session] }
    else if (char && parts[4] === 'version') json = { version: char.version }
    else if (char && parts[4] === 'data') {
      const body = request.postDataJSON()
      if (body.version !== char.version) return route.fulfill({ status: 409, json: { desc: 'Лист изменился' } })
      char.data = body.data; char.version++; json = { version: char.version }
    } else if (char && parts[4] === 'item-transfers') {
      if (request.method() === 'GET') json = { transfers: transfers.filter(t => t.status === 'pending') }
      else if (parts[6] === 'resolve') {
        const transfer = transfers.find(t => t.id === Number(parts[5]))
        const accept = request.postDataJSON().decision === 'accept'
        transfer.status = accept ? 'accepted' : 'rejected'
        const destination = chars[accept ? transfer.recipientCharUuid : transfer.senderCharUuid]
        destination.data.values.items.sections[0].items.push(transfer.entry)
        destination.version++
        json = { transfer }
      } else {
        const body = request.postDataJSON(); requests.push(body)
        expect(body.version).toBe(char.version)
        const entries = char.data.values.items.sections[0].items
        const index = entries.findIndex(entry => entry.uid === body.entryUid)
        expect(index).toBeGreaterThanOrEqual(0)
        const [entry] = entries.splice(index, 1); char.version++
        const transfer = { id: nextId++, entry, itemName: entry.override.name, senderName: char.data.values.name, recipientName: chars[body.recipientCharUuid].data.values.name,
          senderCharUuid: parts[3], recipientCharUuid: body.recipientCharUuid, status: 'pending' }
        transfers.push(transfer); json = { transfer }
      }
    }
    await route.fulfill({ json })
  })
  async function openSheet(uuid) {
    await page.goto(`/tests/tutorials/fixtures/tutorials.html?page=/char/${uuid}`)
    await expect(page.locator('.view')).toBeVisible()
    if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
    else await page.getByRole('tab', { name: 'Снаряжение', exact: true }).click()
    await expect(page.locator('.campaign-block:visible')).toBeVisible()
    if (mobile) await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/settling/)
    await page.evaluate(async () => {
      const stages = document.querySelectorAll('.inner-tabs-content, .inner-tab-pane, .mobile-swipe-track')
      await Promise.all([...stages].flatMap(el => el.getAnimations().map(animation => animation.finished.catch(() => {}))))
    })
  }
  await openSheet('sender')
  await page.getByRole('button', { name: 'Игроки', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Лиора', { exact: false })).toBeVisible()
  await expect(dialog.getByText('Торин', { exact: true })).toBeVisible()
  await expect(dialog.locator('.transfer-avatar')).toHaveCount(2)
  await expect(dialog).toHaveClass(/base-popover/)
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(mobile ? 390 : 1440)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(mobile ? 844 : 1000)
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const decision of ['Отказаться', 'Принять']) {
    const row = page.locator('.di-row:visible').filter({ hasText: 'Шёлковая верёвка' })
    await row.scrollIntoViewIfNeeded()
    // Let the scroll event finish before opening the scroll-dismissed action menu.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    // Click where a user points, without Playwright scrolling transformed carousel ancestors.
    const rowBounds = await row.boundingBox()
    await page.mouse.click(rowBounds.x + rowBounds.width / 2, rowBounds.y + rowBounds.height / 2)
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    // Wait for placement and the enter transition before Playwright scrolls to an action.
    await menu.evaluate(async el => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})))
    })
    await page.getByRole('menuitem', { name: 'Передать другому игроку', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('×3')
    await dialog.getByRole('combobox').selectOption('recipient')
    await dialog.getByRole('button', { name: 'Передать', exact: true }).click()
    await expect(dialog.getByText('Ожидает принятия', { exact: true })).toBeVisible()
    expect(chars.sender.data.values.items.sections[0].items).toHaveLength(0)
    await openSheet('recipient')
    await page.getByRole('button', { name: /События/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: decision, exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Незавершённых событий нет')
    await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).last().click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    if (decision === 'Отказаться') await openSheet('sender')
    else await expect(page.locator('.di-row:visible')).toContainText('Шёлковая верёвка')
  }
  expect(requests).toHaveLength(2)
  expect(requests[0]).toMatchObject({ source: 'items', entryUid: 'rope', sessionUuid: 'campaign', recipientCharUuid: 'recipient' })
  expect(requests[0].clientActionId).not.toBe(requests[1].clientActionId)
  expect(chars.recipient.data.values.items.sections[0].items).toHaveLength(1)
})
