import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

const initialEvent = { id: 1, type: 'resource_used', action: 'Расход заряда', actorCharUuid: 'sender', actorName: 'Лиора', authorName: 'Игрок', authorUserId: 2,
  createdAt: '2026-09-14T12:00:00Z', data: { source: { name: 'Посох', instanceUid: 'staff' }, remaining: 2, delta: -1 } }
async function prepare(page, role = 'dm') {
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    const sources = new Set()
    window.EventSource = class extends EventTarget {
      constructor() { super(); sources.add(this); setTimeout(() => this.onopen?.(), 0) }
      close() { sources.delete(this) }
    }
    window.emitSessionUpdate = () => sources.forEach(source => source.dispatchEvent(new MessageEvent('update', { data: JSON.stringify({ journal: true }) })))
  })
  const events = [structuredClone(initialEvent)], transfers = []
  const session = { uuid: 'test', name: 'Тайны долины', status: 'active', ownerUserId: role === 'dm' ? 1 : 2, systemId: 1 }
  const character = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Торин', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } }
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: ['character', 'session-player', 'session-dm'].flatMap(flowId => ['desktop', 'mobile'].map(device => ({ flowId, sourceKey: flowId === 'character' ? 'edition:1' : 'source:1', device, revision: TUTORIAL_REVISION, status: 'completed' }))) }
    else if (path === '/api/sessions/test') json = { session, participants: [], myRole: role === 'dm' ? 'gm' : 'player' }
    else if (path === '/api/sessions/test/events') {
      const after = Number(url.searchParams.get('after') || 0)
      const projection = event => ({ ...event, sessionOwnerUserId: session.ownerUserId })
      json = { events: events.filter(event => event.id > after).map(projection), updates: events.filter(event => event.id <= after && event.type === 'item_transfer').map(projection) }
    } else if (path === '/api/char/recipient') json = character
    else if (path === '/api/char/recipient/sessions') json = { sessions: [session] }
    else if (path === '/api/char/recipient/version') json = { version: 1 }
    else if (path === '/api/char/recipient/item-transfers') json = { transfers }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    await route.fulfill({ json })
  })
  return { events, transfers }
}
async function open(page, path = '/sessions/test') {
  await page.goto(`/tests/notifications/fixtures/notifications.html?page=${path}`)
  await expect.poll(() => page.evaluate(() => window.notificationFixture?.events.events.length)).toBe(1)
  await expect(page.locator('.app-notification')).toHaveCount(0)
}
const emit = page => page.evaluate(() => window.emitSessionUpdate())
for (const mobile of [false, true]) test(`chronicle arrivals and toast navigation on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const { events } = await prepare(page)
  await open(page)
  events.push({ ...structuredClone(initialEvent), id: 2, action: 'Второе действие' })
  await emit(page)
  const toast = page.locator('[data-notification-type="session-event"]')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Второе действие')
  await toast.getByRole('button', { name: 'Открыть хронику' }).click()
  await expect(page.locator('[data-event-id="2"]')).toBeVisible()
  await expect(toast).toHaveCount(0)
  await page.evaluate(() => { window.originalRow = document.querySelector('[data-event-id="2"]') })
  events.push({ ...structuredClone(initialEvent), id: 3, action: 'Новое действие' })
  await emit(page)
  const row = page.locator('[data-event-id="3"]')
  await expect(row).toHaveClass(/event-row--arriving/)
  expect(await row.evaluate(el => getComputedStyle(el).animationName)).toContain('chronicle-entry-in')
  expect(await page.evaluate(() => window.originalRow === document.querySelector('[data-event-id="2"]'))).toBe(true)
  await expect(toast).toHaveCount(0)
  await expect(row).not.toHaveClass(/event-row--arriving/)
  await emit(page)
  await expect(row).not.toHaveClass(/event-row--arriving/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  events.push({ ...structuredClone(initialEvent), id: 4 })
  await emit(page)
  await expect(page.locator('[data-event-id="4"]')).toHaveClass(/event-row--arriving/)
  expect(await page.locator('[data-event-id="4"]').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
})
test('player session ignores other actors and receives only addressed offers', async ({ page }) => {
  const { events } = await prepare(page, 'player')
  await open(page)
  events.push({ ...structuredClone(initialEvent), id: 2, action: 'Игрок использовал посох' })
  await emit(page)
  await expect.poll(() => page.evaluate(() => window.notificationFixture.events.events.length)).toBe(2)
  await expect(page.locator('.app-notification')).toHaveCount(0)
  events.push({ ...structuredClone(initialEvent), id: 3, type: 'item_transfer', recipientUserId: 1, data: { status: 'pending' } })
  await emit(page)
  await expect(page.locator('.app-notification')).toHaveCount(1)
})
for (const mobile of [false, true]) test(`own sheet receives incoming transfers and updated status on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const { events, transfers } = await prepare(page, 'player')
  await open(page, '/char/recipient')
  transfers.push({ id: 1, senderCharUuid: 'sender', recipientCharUuid: 'recipient', senderName: 'Лиора', recipientName: 'Торин', itemName: 'Посох', status: 'pending' })
  const transfer = { ...structuredClone(initialEvent), id: 2, type: 'item_transfer', recipientUserId: 1, action: 'Передача предмета', data: { source: { name: 'Посох' }, senderName: 'Лиора', recipientName: 'Торин', status: 'pending', count: 1 } }
  events.push(transfer)
  await emit(page)
  const toast = page.locator('.app-notification')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Ожидает')
  await toast.getByRole('button', { name: 'Открыть события' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Принять', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).last().click()
  transfer.data.status = 'accepted'; transfers.length = 0
  await emit(page)
  await expect.poll(() => page.evaluate(() => window.notificationFixture.events.events.find(event => event.id === 2)?.data.status)).toBe('accepted')
  await expect(toast).toHaveCount(0)
  await emit(page)
  await expect(toast).toHaveCount(0)
})

test('dice and events share one bounded queue and keep reroll actions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { events } = await prepare(page)
  await open(page)
  await page.evaluate(() => window.notificationFixture.dice.rollD20('Проверка', 2, 'normal', {
    log: false, roll_triggers: [{ action: 'reroll', event: 'any', label: 'Перебросить' }],
  }))
  const dice = page.locator('[data-notification-type="dice"]')
  await expect(dice.getByRole('button', { name: 'Перебросить', exact: true })).toBeVisible()
  await dice.getByRole('button', { name: 'Перебросить', exact: true }).click()
  await expect(dice).toHaveCount(1)
  await expect(dice.getByRole('button', { name: 'Перебросить', exact: true })).toHaveCount(0)
  events.push({ ...structuredClone(initialEvent), id: 2 })
  await emit(page)
  await expect(page.locator('.app-notification')).toHaveCount(2)
  await dice.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(page.locator('.app-notification')).toHaveCount(1)
  await page.evaluate(() => { for (let i = 0; i < 6; i++) window.notificationFixture.dice.roll('Кубик', 'd6', { log: false }) })
  await expect(page.locator('.app-notification')).toHaveCount(5)
})

test('incoming offer notifies even while the chronicle request fails', async ({ page }) => {
  const { events, transfers } = await prepare(page, 'player')
  await open(page, '/char/recipient')
  await page.route('**/api/sessions/test/events?**', route => route.fulfill({ status: 503, json: { desc: 'Временно недоступно' } }))
  transfers.push({ id: 10, eventId: 20, authorUserId: 2, recipientUserId: 1, sessionOwnerUserId: 2,
    senderCharUuid: 'sender', recipientCharUuid: 'recipient', senderName: 'Лиора', recipientName: 'Торин', itemName: 'Посох', entry: { item_id: 42 }, status: 'pending' })
  await emit(page)
  const toast = page.locator('.app-notification')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Посох')
  await page.unroute('**/api/sessions/test/events?**')
  events.push({ ...structuredClone(initialEvent), id: 20, type: 'item_transfer', recipientUserId: 1, data: { status: 'pending' } })
  await emit(page)
  await expect.poll(() => page.evaluate(() => window.notificationFixture.events.events.length)).toBe(2)
  await expect(toast).toHaveCount(1)
})

for (const mobile of [false, true]) test(`DM approves an offer from the chronicle on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const { events } = await prepare(page)
  await open(page)
  const offer = { ...structuredClone(initialEvent), id: 2, type: 'item_transfer', action: 'Передача: Посох', recipientUserId: 3,
    data: { status: 'pending', recipientName: 'Торин', source: { name: 'Посох' } } }
  events.push(offer)
  let approvals = 0
  await page.route('**/api/sessions/test/events/2/approve', async route => {
    expect(route.request().method()).toBe('POST')
    approvals++
    offer.data.status = 'accepted'
    await route.fulfill({ json: { transfer: { status: 'accepted' } } })
  })
  await emit(page)
  await page.getByRole('button', { name: 'Открыть хронику', exact: true }).click()
  const row = page.locator('[data-event-id="2"]')
  await row.getByRole('button', { name: 'Принять', exact: true }).click()
  await expect(row).toContainText('Приняли')
  await expect(row.getByRole('button', { name: 'Принять', exact: true })).toHaveCount(0)
  expect(approvals).toBe(1)
  await emit(page)
  await expect(row).toHaveCount(1)
})

for (const mobile of [false, true]) test(`session inventory accepts, stores and sends items on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  await prepare(page)
  const session = { uuid: 'test', name: 'Сессия', status: 'active', ownerUserId: 1, systemId: 1 }
  await page.route('**/api/sessions/test', route => route.fulfill({ json: { session, myRole: 'gm', participants: [{ charUuid: 'recipient', templateId: 1, iconImageUrl: '/static/tab-stats.svg', data: { values: { name: 'Торин' } } }] } }))
  let entries = [], offers = [{ id: 30, eventId: 30, itemName: 'Подарок', senderName: 'Лиора', senderCharUuid: 'sender', recipientCharUuid: '', addressedToDm: true, purpose: 'transfer', source: 'items', entry: { count: 2, override: { name: 'Подарок' } } }]
  let nextId = 1, failAdd = true
  const additions = new Set(), addRequests = []
  await page.route('**/api/sessions/test/inventory', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { entries, transfers: offers } })
    const body = route.request().postDataJSON(); addRequests.push(body)
    if (!additions.has(body.clientActionId)) { additions.add(body.clientActionId); entries.push({ id: `entry-${nextId++}`, name: body.name, source: body.source, entry: body.entry }) }
    if (failAdd) { failAdd = false; return route.fulfill({ status: 503, json: { desc: 'Ответ потерян' } }) }
    await route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/sessions/test/events/30/application', async route => {
    expect(route.request().postDataJSON().decision).toBe('accept')
    entries.push({ id: 'gift', name: 'Подарок', source: 'items', entry: offers[0].entry }); offers = []
    await route.fulfill({ json: { transfer: { status: 'accepted' } } })
  })
  await page.route('**/api/sessions/test/inventory/*', async route => {
    expect(route.request().method()).toBe('DELETE')
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    entries = entries.filter(row => row.id !== id)
    await route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/sessions/test/inventory/*/transfer', async route => {
    expect(route.request().postDataJSON().recipientCharUuid).toBe('recipient')
    const id = new URL(route.request().url()).pathname.split('/').at(-2)
    const row = entries.find(row => row.id === id); entries = entries.filter(row => row.id !== id)
    offers = [{ id: 31, eventId: 31, itemName: row.name, recipientName: 'Торин', recipientCharUuid: 'recipient', addressedToDm: false, entry: row.entry }]
    await route.fulfill({ json: { transfer: offers[0] } })
  })
  await open(page)
  await page.getByRole('button', { name: 'Инвентарь', exact: true }).click()
  const inventory = page.getByRole('dialog', { name: 'Инвентарь сессии', exact: true })
  await expect(inventory).toBeVisible()
  await inventory.getByRole('button', { name: 'Принять', exact: true }).click()
  await expect(inventory.locator('.inventory-row')).toContainText('Подарок')
  await inventory.getByRole('button', { name: 'Свой предмет', exact: true }).click()
  await inventory.locator('form input').first().fill('Верёвка')
  await inventory.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(inventory.getByRole('alert')).toContainText('Ответ потерян')
  await inventory.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(inventory.locator('.inventory-row')).toHaveCount(2)
  expect(addRequests).toHaveLength(2)
  expect(addRequests[0].clientActionId).toBe(addRequests[1].clientActionId)
  await inventory.getByRole('button', { name: 'Удалить: Верёвка', exact: true }).click()
  await expect(inventory.locator('.inventory-row')).toHaveCount(1)
  await inventory.getByRole('button', { name: 'Передать: Подарок', exact: true }).click()
  const recipient = page.getByRole('menuitem', { name: 'Торин', exact: true })
  await expect(recipient.locator('img')).toHaveCount(1)
  await recipient.click()
  await expect(inventory.locator('.inventory-row')).toHaveCount(0)
  await expect(inventory).toContainText('Ожидает принятия')
  await expect(inventory).toContainText('Торин')
})

test('DM declines a player-to-player offer from the chronicle', async ({ page }) => {
  const { events } = await prepare(page)
  await open(page)
  const offer = { ...structuredClone(initialEvent), id: 2, type: 'item_transfer', action: 'Передача: Посох', recipientUserId: 3,
    data: { purpose: 'transfer', status: 'pending', recipientName: 'Торин', source: { name: 'Посох' } } }
  events.push(offer)
  await page.route('**/api/sessions/test/events/2/application', async route => {
    expect(route.request().postDataJSON().decision).toBe('reject')
    offer.data.status = 'rejected'
    await route.fulfill({ json: { transfer: { status: 'rejected' } } })
  })
  await emit(page)
  await page.getByRole('button', { name: 'Открыть хронику', exact: true }).click()
  const row = page.locator('[data-event-id="2"]')
  await row.getByRole('button', { name: 'Отказать', exact: true }).click()
  await expect(row).toContainText('Отказали')
  await expect(row.locator('.transfer-decision-actions')).toHaveCount(0)
})
