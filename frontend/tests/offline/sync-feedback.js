import { expect } from '@playwright/test'
import { weaponSheetFixture } from '../tutorials/fixtures/weapon-sheet.js'

export async function checkSyncFeedback(page, base = '', capture) {
  const api = await weaponSheetFixture(page)
  let mode = 200
  await page.route(url => url.pathname.startsWith('/api/sync-feedback'), route => mode === 'network'
    ? route.abort('timedout') : route.fulfill({ status: mode, json: { value: 'cached' } }))
  await page.goto(base + '/char/test?tab=weapons', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const notices = page.locator('[data-notification-type="sync-error"]')
  const noIndicator = async () => {
    await expect(page.locator('.local-status')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Синхронизация данных|Работа без сети|Синхронизация требует внимания)$/ })).toHaveCount(0)
  }
  const request = (path, uncached = false) => page.evaluate(async ({ path, uncached }) => {
    try { const response = await fetch(path, uncached ? { cache: 'no-store' } : {}); return { status: response.status, local: response.headers.get('X-DnDShare-Local'), payload: await response.json() } }
    catch (error) { return { error: error.name } }
  }, { path, uncached })
  const before = structuredClone(api.writes)
  await noIndicator()
  const actionWidth = await page.locator('.workspace-header-actions').first().evaluate(node => node.getBoundingClientRect().width)
  let release
  const hold = async route => { await new Promise(resolve => { release = resolve }); await route.fulfill({ json: { chars: [] } }) }
  await page.route('**/api/chars', hold)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => !!release).toBe(true)
  await noIndicator()
  expect(await page.locator('.workspace-header-actions').first().evaluate(node => node.getBoundingClientRect().width)).toBe(actionWidth)
  await expect(notices).toHaveCount(0)
  release()
  await page.waitForLoadState('networkidle')
  await page.unroute('**/api/chars', hold)

  await request('/api/sync-feedback-probe')
  mode = 504
  await request('/api/sync-feedback-probe?timeout=1', true)
  await expect(notices).toHaveCount(0)
  mode = 'network'
  await request('/api/sync-feedback-probe?offline=1', true)
  await noIndicator()
  await expect(notices).toHaveCount(0)
  mode = 500
  const cached = await request('/api/sync-feedback-probe')
  expect(cached.payload.value).toBe('cached')
  expect(cached.local).toBe('1')
  await expect(notices).toHaveCount(1)
  await expect(notices).toContainText('500')
  await notices.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(notices).toHaveCount(0)
  await request('/api/sync-feedback-probe')
  await request('/api/sync-feedback-other', true)
  await page.waitForLoadState('networkidle')
  await expect(notices).toHaveCount(0)
  mode = 200
  await request('/api/sync-feedback-probe', true)
  await request('/api/sync-feedback-other', true)
  mode = 503
  await request('/api/sync-feedback-probe', true)
  await expect(notices).toHaveCount(1)
  await expect(notices).toContainText('503')
  await notices.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(notices).toHaveCount(0)
  mode = 426
  await request('/api/sync-feedback-other', true)
  await expect(notices).toHaveCount(1)
  await expect(notices).toContainText('Требуется обновление')
  await expect(notices).toContainText('Обновите приложение или страницу')
  await notices.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(notices).toHaveCount(0)
  let conflicts = 0
  await page.route('**/api/chars', route => { conflicts++; return route.fulfill({ status: 409, json: { desc: 'version conflict' } }) })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => conflicts).toBeGreaterThan(0)
  await expect(notices).toHaveCount(1)
  await expect(notices).toContainText('Конфликт синхронизации')
  await noIndicator()
  if (capture) await capture(page)
  expect(api.writes).toEqual(before)
  return { busyAndOfflineHidden: true, stableHeaderWidth: true, transportAnd504Silent: true, cachedDataRetained: true,
    server500NotifiedOnce: true, repeatedFailuresSilentAfterDismiss: true, recoveryAllowsNew503Notice: true, version426Notified: true, conflict409Notified: true, noCharacterWrites: true }
}
