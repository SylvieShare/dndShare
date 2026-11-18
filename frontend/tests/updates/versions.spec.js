import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fixture } from '../tutorials/fixtures/character-layout'
const release = JSON.parse(readFileSync(new URL('../../../release/versions.json', import.meta.url), 'utf8'))

test('Android applies a pending update from the sessions list after the invite draft is cleared', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 751 })
  await page.addInitScript(() => {
    window.CapacitorCustomPlatform = { name: 'android' }
    window.__updateApplies = []
    const state = { android: { version: '0.3.8' }, bootToken: 'current-boot', active: { bundleId: 'builtin' }, pending: true }
    const plugins = {
      LocalStore: ['get', 'scan', 'batch', 'clear'],
      FrontendUpdater: ['getStatus', 'ready', 'check', 'checkpoint', 'apply'],
    }
    window.Capacitor = {
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({
        name, methods: [...methods.map(method => ({ name: method, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }],
      })),
      nativeCallback: () => 'listener',
      nativePromise: async (plugin, method, args) => {
        if (plugin === 'LocalStore') return method === 'scan' ? { entries: [] } : {}
        if (method === 'apply') window.__updateApplies.push(args)
        return state
      },
    }
  })
  await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  await page.route('**/api/sessions', route => route.fulfill({ json: [] }))
  await page.route('**/api/build-info', route => route.fulfill({ json: { backend: { version: '0.9.4', build: 22, apiContract: 1 }, frontend: release.frontend } }))
  await page.goto('/sessions')
  const code = page.getByRole('textbox', { name: 'Код приглашения', exact: true })
  const panel = page.getByRole('dialog', { name: 'Версии приложения', exact: true })
  const restart = panel.getByRole('button', { name: 'Перезапустить и обновить', exact: true })
  const openVersions = async () => {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await page.getByRole('button', { name: /^Версии: фронт/ }).click()
    await expect(restart).toBeEnabled()
  }
  await code.fill('ABCDE-12345')
  await openVersions()
  await restart.click()
  await expect(panel.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => window.__updateApplies)).toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Закрыть меню', exact: true }).click()
  await expect(code).toHaveValue('ABCDE-12345')
  await code.clear()
  await openVersions()
  await restart.click()
  await expect.poll(() => page.evaluate(() => window.__updateApplies)).toEqual([{ bootToken: 'current-boot' }])
  await expect(panel.getByRole('alert')).toHaveCount(0)
})

for (const width of [390, 834, 1440]) test(`sidebar reports the actual frontend and live backend at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await fixture(page)
  await page.route('**/api/build-info', route => route.fulfill({ json: { backend: { version: '0.9.4', build: 22, commitSha: 'a'.repeat(40), apiContract: 1 }, frontend: { version: '9.0.0', build: 999 } } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  await page.goto('/chars')
  if (width < 1200) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const versions = page.getByRole('button', { name: new RegExp(`Версии: фронт ${release.frontend.version}, бэк 0.9.4`) })
  await expect(versions).toBeVisible({ timeout: 15000 })
  await expect(versions).toContainText(`Фронт ${release.frontend.version}`)
  await expect(versions).toContainText('Бэк 0.9.4')
  await expect(versions).not.toContainText('9.0.0')
  await versions.click()
  const panel = page.getByRole('dialog', { name: 'Версии приложения', exact: true })
  await expect(panel).toContainText('Бэкенд 0.9.4')
  await expect(panel).toContainText('aaaaaaaa')
  await page.keyboard.press('Escape')
  if (width >= 1200) {
    await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click()
    await expect(versions).toBeVisible()
    await versions.click()
    await expect(panel).toBeVisible()
  }
})
