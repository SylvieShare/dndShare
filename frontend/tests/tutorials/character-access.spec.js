import { test, expect } from '@playwright/test'
for (const mobile of [false, true]) for (const guest of [false, true]) {
  test(`read only reason and cloning ${mobile ? 'mobile' : 'desktop'} ${guest ? 'guest' : 'player'}`, async ({ page }) => {
    page.on('pageerror', error => { throw error })
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    const writes = []
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let json = {}
      if (route.request().method() !== 'GET') writes.push(path)
      if (path === '/api/char/other/clone') json = { uuid: 'copy' }
      else if (path === '/api/char/other' || path === '/api/char/copy') json = { templateName: 'DND5', userId: path.endsWith('/copy') ? 1 : 2, sourceVersionId: 1, version: 1, publicVisible: true, data: { values: { name: path.endsWith('/copy') ? 'Торин (копия)' : 'Торин', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] }, STR: { value: 10 } }, var: { stats: {} } } }
      else if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: 1, status: 'completed' })) }
      else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
      await route.fulfill({ json })
    })
    await page.goto(`/tests/tutorials/fixtures/tutorials.html?page=/char/other${guest ? '&guest=1' : ''}`)
    const notice = page.locator('.read-only-notice:visible').first()
    await expect(notice).toContainText('Режим просмотра')
    await expect(notice).toContainText(guest ? 'Вы не авторизованы' : 'принадлежит другому игроку')
    await expect(page.locator('.morph-tile-heading--editable:visible')).toHaveCount(0)
    if (mobile) await page.getByRole('button', { name: 'Меню', exact: true }).click()
    else await page.locator('.sm-tile:visible').click()
    if (guest) await page.evaluate(() => { window.addEventListener('dndshare:request-auth', e => { window.requestedAuth = e.detail.reason }) })
    await page.getByRole('button', { name: 'Клонировать себе', exact: true }).click()
    if (guest) {
      expect(await page.evaluate(() => window.requestedAuth)).toBe('clone-character')
      expect(writes).toEqual([])
    } else {
      await expect(page.locator('.read-only-notice:visible')).toHaveCount(0)
      await expect(page.locator('.view')).toContainText('Торин (копия)')
      expect(writes).toEqual(['/api/char/other/clone'])
    }
  })
}
