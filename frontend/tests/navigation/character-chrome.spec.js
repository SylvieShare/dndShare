import { expect, test } from '@playwright/test'

const source = { id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }
async function fixture(page) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: {
      '/api/user/checkAuth': { auth: true, user: { id: 1, login: 'tester', roles: [], hasCharacters: true, gameContext: { sourceVersionId: 1 } } },
      '/api/sources': { sources: [source] },
      '/api/templates': { templates: [{ id: 1, name: 'DND5', sourceId: 1 }] },
      '/api/chars': { chars: Array.from({ length: 30 }, (_, index) => ({
        id: index + 1, uuid: 'chrome-' + index, userId: 1, templateId: 1,
        sourceId: 1, sourceName: 'D&D 5e', sourceVersion: '2014', changedAt: '2026-10-29T08:00:00Z',
        data: { values: { name: 'Персонаж ' + index, lvl: { level: 1 }, classes: [] }, var: {} },
      })) },
      '/api/suggest/types': { items: [] }, '/api/sessions/active': { sessions: [] },
      '/api/item-types': { types: [] },
    }[path] || {} })
  })
}

for (const width of [320, 834, 1440]) test(`character actions stay in sharp subheader above a fading backdrop at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  await fixture(page)
  await page.goto('/chars')
  await expect(page.locator('.char-card')).toHaveCount(30, { timeout: 20000 })
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0)
  const subheader = page.locator('.app-header .workspace-subheader')
  await expect(subheader.getByRole('heading', { name: 'Персонажи', exact: true })).toBeVisible()
  await expect(subheader.getByRole('button', { name: 'Новый персонаж', exact: true })).toBeVisible()
  expect(await page.locator('.page > .page-header').count()).toBe(0)
  await expect(page.getByPlaceholder('Найти персонажа')).toHaveCount(0)
  const colors = await page.locator('.workspace-subheader-inner').evaluate(element => {
    const css = getComputedStyle(element); return { surface: css.getPropertyValue('--subheader'), block: css.getPropertyValue('--surface'), bg: css.backgroundColor }
  })
  expect(colors.bg).toBe('rgb(53, 49, 63)')
  await expect(page.locator('.workspace-subheader-inner')).toHaveCSS('filter', 'none')
  const effect = await page.locator('.app-header').evaluate(element => {
    const css = getComputedStyle(element, '::before')
    return { blur: css.backdropFilter, mask: css.maskImage, pointer: css.pointerEvents }
  })
  expect(effect.blur).toBe('blur(16px)')
  expect(effect.mask).toContain('linear-gradient')
  expect(effect.pointer).toBe('none')
  const before = await subheader.boundingBox()
  await page.evaluate(() => scrollTo(0, 500))
  await expect.poll(async () => (await subheader.boundingBox()).y).toBeCloseTo(before.y, 0)
  const card = await page.locator('.char-card').first().boundingBox()
  expect(card.y).toBeLessThan(before.y + before.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await subheader.getByRole('button', { name: 'Новый персонаж', exact: true }).click()
  await expect(page).toHaveURL(/\/chars\/new/)
  await expect(page.locator('#app-character-subheader')).toHaveCount(0)
  expect(errors).toEqual([])
})
