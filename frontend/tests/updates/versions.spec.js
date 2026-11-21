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
  const restart = updateButton(page)
  const alert = page.getByRole('alert').filter({ hasText: 'Закройте форму' })
  await code.fill('ABCDE-12345')
  await openSidebar(page)
  await restart.click()
  await expect(alert).toBeVisible()
  expect(await page.evaluate(() => window.__updateApplies)).toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Закрыть меню', exact: true }).click()
  await expect(code).toHaveValue('ABCDE-12345')
  await code.clear()
  await openSidebar(page)
  await restart.click()
  await expect.poll(() => page.evaluate(() => window.__updateApplies)).toEqual([{ bootToken: 'current-boot' }])
  await expect(alert).toHaveCount(0)
})

const updateButton = page => page.getByRole('button', { name: 'Обновить и перезапустить', exact: true })
const openSidebar = page => page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
const versionControl = page => page.getByRole('button', { name: /^Версии:/ })

for (const width of [390, 834, 1440]) test(`sidebar offers a page reload only for a newer frontend build at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await fixture(page)
  let offeredBuild = release.frontend.build + 1
  await page.route('**/api/build-info', route => route.fulfill({ json: {
    backend: { version: '0.9.4', build: 22, apiContract: 1 },
    frontend: { version: '9.0.0', build: offeredBuild },
  } }))
  await page.goto('/chars')
  if (width < 1200) await openSidebar(page)

  const update = updateButton(page)
  const account = page.getByRole('button', { name: 'tester', exact: true })
  await expect(update).toBeVisible()
  await expect(account).toBeVisible()
  const updateBox = await update.boundingBox()
  const accountBox = await account.boundingBox()
  expect(updateBox.x).toBeGreaterThanOrEqual(accountBox.x + accountBox.width)
  expect(Math.abs(updateBox.y + updateBox.height / 2 - accountBox.y - accountBox.height / 2)).toBeLessThan(1)
  await expect(versionControl(page)).toHaveCount(0)

  const navOrder = await page.locator('.desktop-sidebar .share-sidebar-nav').evaluate(nav =>
    [...nav.children].map(element => element.className).filter(name => /sidebar-search|game-context|separator/.test(name)))
  expect(navOrder).toEqual([
    expect.stringContaining('sidebar-search'),
    'game-context',
    'sidebar-search-separator',
  ])

  if (width >= 1200) {
    await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click()
    await expect(update).toBeVisible()
  }

  offeredBuild = release.frontend.build
  const reload = page.waitForEvent('framenavigated', frame => frame === page.mainFrame())
  await update.click()
  await reload
  if (width < 1200) await openSidebar(page)
  await expect(account).toBeVisible()
  await expect(update).toHaveCount(0)
  await expect(versionControl(page)).toHaveCount(0)
})
