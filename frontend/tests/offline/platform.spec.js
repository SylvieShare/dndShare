import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

const apiOnly = url => url.pathname.startsWith('/api/')

async function prepare(page) {
  await page.setViewportSize({ width: 390, height: 900 })
  const api = await fixture(page)
  await page.route('**/api/chars', route => route.fulfill({ json: { chars: [{ uuid: 'test', name: 'Лира' }] } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, full: true, hasMore: false, cursor: 'done', visibleIds: [701],
    entries: [{ id: 701, revision: 1, item: { id: 701, typeId: 1, name: 'Локальный меч', compatibility: [{ sourceVersionId: 1, status: 'native' }], data: {} } }],
    metadata: { types: [{ id: 1, sourceId: 1 }], suggestTypes: [], suggests: { 16: [{ id: 1, value: 'Сила' }] }, books: [] },
  } }))
  await page.goto('/char/test')
  await expect(page.locator('[data-sheet-field="STR"]:visible')).toBeVisible({ timeout: 15000 })
  await expect.poll(() => page.evaluate(async () => {
    const { localState } = await import('/src/platform/offline.js')
    const { openLocalDatabase } = await import('/src/platform/storage.js')
    const db = await openLocalDatabase()
    return !localState.syncing && Boolean(await db.get('account:1:handbook:1:position'))
  })).toBe(true)
  return api
}

test('downloaded sheet and an unvisited catalogue query work without API access after restart', async ({ page }) => {
  await prepare(page)
  await page.route(apiOnly, route => route.abort('internetdisconnected'))
  await page.reload()
  await expect(page.locator('[data-sheet-field="STR"]:visible')).toBeVisible()
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/items/search?typeId=1&q=меч&sourceVersionId=1')
    return response.json()
  })
  expect(result.items.map(item => item.name)).toEqual(['Локальный меч'])
  await expect(page.getByRole('button', { name: 'Работа без сети', exact: true }).first()).toBeVisible()
})

test('a local edit survives reload offline and reaches the server once after reconnect', async ({ page }) => {
  const api = await prepare(page)
  await page.evaluate(async () => {
    const { createDocumentSync } = await import('/src/shared/lib/documentSync.js')
    const { openLocalDatabase } = await import('/src/platform/storage.js')
    const db = await openLocalDatabase()
    const snapshot = (await db.get('account:1:http:/api/char/test')).payload
    const sync = createDocumentSync({ data: snapshot.data, version: snapshot.version,
      storageKey: 'dndshare.document-pending.v1.character:1:test', send: async () => { throw new TypeError('offline') } })
    await sync.ready
    sync.edit({ ...snapshot.data, values: { ...snapshot.data.values, person_traits: '<p><b>Смелая</b></p>' } })
    await sync.flush()
    sync.stop()
  })
  await page.route(apiOnly, route => route.abort('internetdisconnected'))
  await page.reload()
  await expect(page.locator('[data-sheet-field="STR"]:visible')).toBeVisible()
  await page.getByRole('button', { name: 'Личность', exact: true }).click()
  await expect(page.locator('[data-sheet-field="person_traits"]')).toContainText('Смелая')
  await page.unroute(apiOnly)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => api.document().values.person_traits).toBe('<p><b>Смелая</b></p>')
  expect(api.writes).toHaveLength(1)
})

test('logout clears identity, downloaded data and durable queues', async ({ page }) => {
  await prepare(page)
  const cleared = await page.evaluate(async () => {
    const { clearLocalAccount } = await import('/src/platform/offline.js')
    const { allLocalRecords, openLocalDatabase } = await import('/src/platform/storage.js')
    await clearLocalAccount()
    return { identity: await (await openLocalDatabase()).get('identity'), records: await allLocalRecords('account:') }
  })
  expect(cleared).toEqual({ identity: null, records: [] })
})
