import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const output = process.env.DNDSHARE_UI_REVIEW_OUTPUT
test.skip(!output, 'Opt-in paired review: scripts/visual/compare.py')
const root = fileURLToPath(new URL('../../..', import.meta.url))
const matrix = JSON.parse(readFileSync(path.join(root, 'scripts/visual/matrix.json')))
const api = process.env.DNDSHARE_REVIEW_API

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].filter(img => img.getBoundingClientRect().width > 0)
      .map(async img => { await img.decode() }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await expect(page.locator('.item-detail-cover-loading')).toHaveCount(0)
  // Observe layout stability without changing application content/styles.
  await expect.poll(() => page.evaluate(() => document.getAnimations()
    .filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)
    .length)).toBe(0)
}

for (const format of matrix.formats) {
  test(`paired review ${format.name}`, async ({ page, context, baseURL, browser }) => {
    const fixture = JSON.parse(readFileSync(path.join(output, 'fixture.json')))
    const errors = []
    const external = []
    const apiRequests = []
    page.on('pageerror', error => errors.push(error.message))
    // Every API request is forwarded to the actual test server. No canned responses.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/')) {
        apiRequests.push(url.pathname + url.search)
        const response = await route.fetch({ url: api + url.pathname + url.search })
        return route.fulfill({ response })
      }
      if ([new URL(baseURL).origin, api].includes(url.origin)) return route.continue()
      external.push(url.href)
      return route.abort('blockedbyclient')
    })
    await page.setViewportSize({ width: format.width, height: format.height })
    const login = await context.request.post(`${api}/api/user/auth`, {
      data: { login: fixture.login, password: fixture.password },
    })
    expect((await login.json()).auth).toBe(true)
    const auth = await context.request.get(`${api}/api/user/checkAuth`)
    expect((await auth.json()).user.gameContext.sourceVersionId).toBe(fixture.edition.id)
    const servedFixture = await (await context.request.get(`${api}/__test/fixture`)).json()
    expect(servedFixture.dataFixtureHash).toBe(fixture.dataFixtureHash)
    const entries = []
    mkdirSync(path.join(output, 'web'), { recursive: true })

    async function snapshot(state) {
      await settle(page)
      const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, unit: 'px' }))
      expect(dimensions).toEqual({ width: format.width, height: format.height, unit: 'px' })
      const file = `web/${format.name}-${state}.png`
      const buffer = await page.screenshot({ path: path.join(output, file), fullPage: false })
      entries.push({ platform: 'web', format: format.name, state, file, dimensions,
        viewport: { width: format.width, height: format.height, unit: 'CSS px' },
        recordID: state === 'record' ? fixture.recordID : null,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        browserVersion: browser.version(), apiRequests: [...apiRequests],
      })
    }

    await page.goto('/handbook')
    await expect(page).toHaveTitle('Справочник · D&D 5e · 2014')
    await expect(page.locator('.hb-collection-card')).toHaveCount(fixture.types.length)
    for (const type of fixture.types) {
      const card = page.locator('.hb-collection-card').filter({ hasText: type.name })
      await expect(card.locator('.hb-card-count-num')).toHaveText(String(type.count))
    }
    await snapshot('collections')
    if (format.name !== 'wide') {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).first().click()
      await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: 'Свернуть панель', exact: true })).toBeVisible()
    }
    await snapshot('menu')
    if (format.name !== 'wide') await page.keyboard.press('Escape')
    await page.locator('.hb-collection-card').filter({ hasText: 'Заклинания' }).click()
    await expect(page.locator('.handbook-col-bar .col-type-count')).toHaveText('205')
    await page.locator('.handbook-list .list-row').filter({ hasText: fixture.recordName }).click()
    await expect(page.locator('.handbook-detail h1')).toHaveText(fixture.recordName)
    await expect(page.locator('.item-detail-cover')).toBeVisible()
    await snapshot('record')
    expect(errors).toEqual([])
    expect(external).toEqual([])
    expect(apiRequests.some(request => request.startsWith('/api/items'))).toBe(true)
    writeFileSync(path.join(output, `web-${format.name}.json`), JSON.stringify(entries, null, 2))
  })
}
