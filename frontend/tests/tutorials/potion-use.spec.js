import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

for (const mobile of [false, true]) test(`potion use reserves one dose, requests consent and consumes on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const item = { uid: 'potion', item_id: null, count: 3, override: { name: 'Зелье лечения', desc: 'Восстанавливает хиты' }, params: {} }
  const character = (name, items) => ({ templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name, hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    potions: items, items: { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [] }] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } })
  const chars = { sender: character('Лиора', [item]), recipient: character('Торин', []) }
  const session = { uuid: 'campaign', name: 'Тайны долины' }
  let transfers = [], nextId = 1, connected = true
  const requests = []
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const parts = path.split('/'), char = chars[parts[3]]
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION, status: 'completed' })) }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/sessions/campaign') json = { session, participants: Object.entries(chars).map(([charUuid, c]) => ({ charUuid, templateId: 1, data: c.data, iconImageUrl: '/static/tab-stats.svg' })) }
    else if (char && parts.length === 4) json = char
    else if (char && parts[4] === 'sessions') json = { sessions: connected ? [session] : [] }
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
        if (accept) transfer.applicationResult = { healing: { formula: '2d4 + 2', dice: [2, 4], total: 8, applied: 0 } }
        const destination = chars[accept ? transfer.recipientCharUuid : transfer.senderCharUuid]
        if (!accept) { destination.data.values.potions[0].count++; destination.version++ }
        json = { transfer }
      } else {
        const body = request.postDataJSON(); requests.push(body)
        expect(body.version).toBe(char.version)
        const entries = char.data.values.potions
        const index = entries.findIndex(entry => entry.uid === body.entryUid)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(body.purpose).toBe('use')
        const entry = { ...entries[index], count: 1 }; entries[index].count--; char.version++
        const transfer = { id: nextId++, entry, purpose: body.purpose, source: body.source, itemName: entry.override.name, senderName: char.data.values.name, recipientName: chars[body.recipientCharUuid].data.values.name,
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
    if (connected) await expect(page.locator('.campaign-block:visible')).toBeVisible()
    if (mobile) await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/settling/)
    await page.evaluate(async () => {
      const stages = document.querySelectorAll('.inner-tabs-content, .inner-tab-pane, .mobile-swipe-track')
      await Promise.all([...stages].flatMap(el => el.getAnimations().map(animation => animation.finished.catch(() => {}))))
    })
  }
  async function openPotionMenu() {
  const row = page.locator('.ps-glasswrap:visible')
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
  }
  await openSheet('sender')
  for (const decision of ['Отказать', 'Принять']) {
    await openPotionMenu()
    await expect(page.getByRole('menuitem', { name: 'Использовать на себя', exact: true })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Использовать на…', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'На себя', exact: true })).toBeVisible()
    await expect(page.getByText(/^На кого использовать:/)).toHaveCount(0)
    const recipient = page.getByRole('menuitem', { name: 'Торин', exact: true })
    await expect(recipient).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Передать', exact: true })).toHaveCount(0)
    await expect(recipient.locator('img')).toHaveCSS('width', '48px')
    await recipient.click()
    await expect(page.locator('.ps-badge:visible')).toHaveText('×2')
    expect(chars.sender.data.values.potions[0].count).toBe(2)
    await page.getByRole('button', { name: 'События', exact: true }).click()
    await expect(page.locator('.transfer-offer > svg[aria-label="Кому"] + .transfer-person')).toContainText('Торин')
    await expect(page.locator('.transfer-offer')).not.toContainText('Лиора')
    await openSheet('recipient')
    await page.getByRole('button', { name: /События/ }).click()
    await expect(page.locator('.transfer-event')).toHaveClass(/base-tile--framed/)
    await expect(page.locator('.transfer-event .transfer-person')).toContainText('Лиора')
    await expect(page.locator('.transfer-offer > .transfer-person + svg[aria-label="От кого"]')).toBeVisible()
    await expect(page.locator('.transfer-event')).not.toContainText('Одна доза')
    await expect(page.getByText('Ожидает вашего решения')).toHaveCount(0)
    await page.getByRole('dialog').getByRole('button', { name: 'Зелье лечения', exact: true }).click()
    const itemDialog = page.getByRole('dialog', { name: 'Зелье лечения', exact: true })
    await expect(itemDialog).toBeVisible()
    await expect(itemDialog).toContainText('Восстанавливает хиты')
    await itemDialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await page.getByRole('button', { name: 'События', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: decision, exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Незавершённых событий нет')
    const result = page.locator('[data-notification-type="application"]')
    if (decision === 'Принять') {
      await expect(result).toContainText('Восстановлено хитов: 0')
      await expect(result.locator('.dice-roll-result')).toContainText('= 8')
      await result.getByRole('button', { name: 'Закрыть уведомление' }).click()
    } else {
      await expect(result).toHaveCount(0)
      await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).last().click()
    }
    await expect(page.getByRole('dialog')).toHaveCount(0)
    if (decision === 'Отказать') await openSheet('sender')
    else expect(chars.recipient.data.values.potions).toHaveLength(0)
  }
  expect(requests).toHaveLength(2)
  expect(requests[0]).toMatchObject({ purpose: 'use', source: 'potions', entryUid: 'potion', sessionUuid: 'campaign', recipientCharUuid: 'recipient' })
  expect(requests[0].clientActionId).not.toBe(requests[1].clientActionId)
  expect(chars.recipient.data.values.potions).toHaveLength(0)
  connected = false
  await openSheet('sender')
  await openPotionMenu()
  await page.getByRole('menuitem', { name: 'Использовать на…', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'На себя', exact: true })).toBeVisible()
  connected = true
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/char/sender&guest')
  if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
  else await page.getByRole('tab', { name: 'Снаряжение', exact: true }).click()
  await openPotionMenu()
  await expect(page.getByRole('menuitem', { name: 'Использовать на себя', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Использовать на…', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Удалить (−1)', exact: true })).toHaveCount(0)
})
