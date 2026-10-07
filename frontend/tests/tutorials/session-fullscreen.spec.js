import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) for (const role of ['dm', 'player']) {
  test(`fullscreen session returns to the list ${role} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    const viewport = mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 }
    await page.setViewportSize(viewport)
    page.on('pageerror', error => { throw error })
    await page.addInitScript(() => {
      window.EventSource = class {
        constructor() { setTimeout(() => this.onopen?.(), 0) }
        addEventListener() {}
        removeEventListener() {}
        close() {}
      }
    })
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let json = {}
      if (path === '/api/sessions/test') json = {
        session: { uuid: 'test', name: 'Приключение', ownerUserId: role === 'dm' ? 1 : 2, systemId: 1, status: 'stopped' },
        participants: [], myRole: role === 'dm' ? 'gm' : 'player',
      }
      else if (path === '/api/sessions') json = []
      else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
      else if (path === '/api/account/tutorials') json = { tutorials: [{ flowId: `session-${role}`, sourceKey: 'source:1', device: mobile ? 'mobile' : 'desktop', status: 'completed', revision: 1 }] }
      await route.fulfill({ json })
    })
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test&fullApp')
    await expect(page.locator('.session-loading')).toHaveCount(0)
    const back = page.getByRole('button', { name: 'К списку сессий', exact: true })
    await expect(back).toBeVisible()
    await expect(page.locator('.app-sidebar')).toHaveCount(0)
    await expect(page.locator('.app-header')).toHaveCount(0)
    await expect(page.locator('.notification-stack')).toHaveCount(1)
    const bounds = await page.locator('.session-page').boundingBox()
    expect(bounds).toEqual({ x: 0, y: 0, ...viewport })
    const offset = await back.evaluate(button => {
      const icon = button.querySelector(':scope > svg').getBoundingClientRect()
      const label = button.querySelector(':scope > span').getBoundingClientRect()
      return Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2)
    })
    expect(offset).toBeLessThan(1)
    await back.click()
    await expect.poll(() => page.evaluate(() => window.tutorialRoute())).toBe('/sessions')
    await expect(page.locator('.session-page')).toHaveCount(0)
    await expect(page.locator(mobile ? '.app-header' : '.app-sidebar')).toBeVisible()
  })
}
