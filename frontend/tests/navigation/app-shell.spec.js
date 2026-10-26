import { expect, test } from '@playwright/test'

const sources = [{ id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }]
const types = [{ id: 5, sourceId: 1, name: 'Заклинания', countItems: 12, fields: [] }]
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: {
      '/api/user/checkAuth': { auth: true, user: { id: 1, login: 'tester', roles: [], hasCharacters: true, gameContext: { sourceVersionId: 1 } } },
      '/api/sources': { sources }, '/api/item-types': { types },
      '/api/suggest/types': { items: [] }, '/api/sessions/active': { sessions: [] },
      '/api/chars': { chars: [] },
    }[path] || {} })
  })
})

for (const width of [320, 390, 599, 600, 834, 1199, 1200, 1440]) {
  test(`native-style shell and drawer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/handbook')
    await expect(page.locator('.hb-collection-card')).toHaveCount(1, { timeout: 20000 })
    const header = page.locator('.app-header')
    const rail = page.locator('.desktop-sidebar--rail')
    const desktop = page.locator('.desktop-sidebar--desktop')
    const drawer = page.getByRole('dialog', { name: 'Меню приложения' })
    if (width >= 1200) {
      await expect(header).toHaveCount(0)
      await expect(desktop).toBeVisible()
      await expect.poll(async () => (await desktop.boundingBox()).width).toBe(224)
      await expect(page.getByRole('button', { name: 'Открыть меню' })).toHaveCount(0)
    } else {
      await expect(header.locator('.header-title')).toHaveText('Справочник')
      await expect(header.locator('.header-context')).toHaveText('D&D 5e · 2014')
      expect((await header.boundingBox()).height).toBe(65)
      if (width >= 600) {
        await expect(rail).toBeVisible()
        expect((await rail.boundingBox()).width).toBe(64)
      } else await expect(rail).toHaveCount(0)
      const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true })
      await trigger.click()
      await expect(drawer).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Персонажи', exact: true })).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Админка', exact: true })).toHaveCount(0)
      const panel = drawer.locator('.desktop-sidebar--drawer')
      expect((await panel.boundingBox()).width).toBeLessThanOrEqual(288)
      const stageBefore = await page.locator('.page-transition-stage').boundingBox()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      await expect(trigger).toBeFocused()
      expect((await page.locator('.page-transition-stage').boundingBox()).x).toBe(stageBefore.x)
      await trigger.click()
      await drawer.getByRole('link', { name: 'Правила игрока', exact: true }).click()
      await expect(page).toHaveURL(/\/rules\/dnd5e\/2014/)
      await expect(drawer).toBeHidden()
      await expect(page.locator('.app-header .header-title')).toContainText('Правила')
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('drawer closes on desktop resize without overwriting the desktop preference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/handbook')
  await page.getByRole('button', { name: 'Свернуть панель' }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dndshare-desktop-sidebar-expanded'))).toBe('false')
  await page.setViewportSize({ width: 834, height: 900 })
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Меню приложения' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await page.locator('.desktop-sidebar--desktop').boundingBox()).width).toBe(64)
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

test.describe('touch navigation', () => {
  test.use({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  test('edge swipe opens the menu and vertical scroll keeps it closed', async ({ page }) => {
    await page.goto('/handbook')
    await expect(page.locator('.hb-collection-card')).toHaveCount(1, { timeout: 20000 })
    const cdp = await page.context().newCDPSession(page)
    async function swipe(points) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] })
      for (const point of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const drawer = page.getByRole('dialog', { name: 'Меню приложения' })
    await swipe([{ x: 5, y: 500 }, { x: 6, y: 450 }, { x: 8, y: 350 }])
    await expect(drawer).toBeHidden()
    await swipe([{ x: 5, y: 500 }, { x: 40, y: 500 }, { x: 100, y: 500 }])
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Закрыть меню' }).click()
    await expect(drawer).toBeHidden()
  })
})

test('game context popover stays above the drawer and Escape closes only the top layer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/handbook')
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Меню приложения' })
  await drawer.getByRole('button', { name: 'Игровая система: D&D 5e · 2014', exact: true }).click()
  const option = page.getByRole('menuitemradio', { name: 'D&D 5e · 2014', exact: true })
  await expect(option).toBeVisible()
  await expect(option).toBeFocused()
  const box = await option.boundingBox()
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="menuitemradio"]'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true)
  await page.keyboard.press('Escape')
  await expect(option).toBeHidden()
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
})
