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

test.describe('hybrid input on the game context', () => {
  test.use({ hasTouch: true, viewport: { width: 475, height: 751 }, reducedMotion: 'reduce' })

  test('tap closes the menu without leaving hover and the mouse restores it', async ({ page }) => {
    await page.goto('/handbook')
    const trigger = page.locator('.app-header').getByRole('button', { name: /^Игровая система:/ })
    const menu = page.getByRole('menu', { name: 'Система и редакция' })
    const idleColor = await trigger.evaluate(button => getComputedStyle(button).backgroundColor)
    await trigger.hover()
    const hoverColor = await trigger.evaluate(button => getComputedStyle(button).backgroundColor)
    expect(hoverColor).not.toBe(idleColor)

    await trigger.tap()
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveCSS('background-color', hoverColor)
    await page.touchscreen.tap(5, 730)
    await expect(menu).toHaveCount(0)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveCSS('background-color', idleColor)
    await trigger.hover()
    await expect(trigger).toHaveCSS('background-color', hoverColor)
  })
})
