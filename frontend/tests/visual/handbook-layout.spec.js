import { expect, test } from '@playwright/test'

const sources = [{ id: 1, name: 'dnd5e', countItems: 45, versions: [{ id: 1, version: '2014' }] }]
const type = { id: 6, sourceId: 1, name: 'Бестиарий', count: 45, countItems: 45, fields: [] }
const items = Array.from({ length: 45 }, (_, index) => ({
  id: index + 1,
  typeId: 6,
  name: `Существо ${String(index + 1).padStart(2, '0')}`,
  data: { description: '<p>Длинное описание существа для проверки прокрутки карточки.</p>'.repeat(80) },
}))

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    let json = {}
    if (url.pathname === '/api/sources') json = { sources }
    if (url.pathname === '/api/item-types') json = { types: [type] }
    if (url.pathname === '/api/items') {
      const offset = Number(url.searchParams.get('offset'))
      const limit = Number(url.searchParams.get('limit')) || 30
      json = { items: items.slice(offset, offset + limit) }
    }
    if (url.pathname === '/api/user/checkAuth') json = { auth: false }
    await route.fulfill({ json })
  })
})

for (const width of [320, 390, 560, 700, 1280]) {
  test(`collection and long detail remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/handbook?type=6')
    const list = page.locator('.handbook-list')
    const detail = page.locator('.handbook-detail')
    await expect(list.locator('.list-row')).toHaveCount(30, { timeout: 20000 })
    await expect(page.locator('.handbook-col-bar .col-type-name')).toHaveText('Бестиарий')
    await expect(page.locator('.handbook-col-bar .col-type-count')).toHaveText('45')
    await expect(page.getByText('К коллекциям', { exact: true })).toHaveCount(0)
    await expect(page.locator('.header-chip')).toHaveCount(0)

    const body = page.locator('.handbook-body')
    if (width <= 760) {
      expect((await list.boundingBox()).width).toBeCloseTo((await body.boundingBox()).width, 0)
      await expect(detail).toBeHidden()
    }
    // Exercise actual wheel scrolling, including pagination at the end of the list.
    await list.locator('.list-body').hover()
    await page.mouse.wheel(0, 3000)
    await expect(list.locator('.list-row')).toHaveCount(45)
    await list.locator('.list-row').first().scrollIntoViewIfNeeded()
    await list.locator('.list-row').first().click()
    await expect(detail.locator('h1')).toHaveText('Существо 01')
    await detail.getByRole('button', { name: 'Описание', exact: true }).click()

    if (width <= 760) {
      await expect(list).toBeHidden()
      await expect(page.locator('.handbook-col-bar')).toBeHidden()
      const bounds = await detail.boundingBox()
      const workspace = await body.boundingBox()
      expect(bounds.x).toBeCloseTo(workspace.x, 0)
      expect(bounds.width).toBeCloseTo(workspace.width, 0)
      await expect(detail).toHaveCSS('border-left-width', '0px')
      await expect(detail).toHaveCSS('border-radius', '0px')
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(801)
      if (width <= 640) await expect(page.getByRole('button', { name: 'К списку', exact: true })).toBeHidden()
    } else {
      await expect(list).toBeVisible()
      expect((await detail.boundingBox()).x).toBeGreaterThan((await list.boundingBox()).x)
    }

    await detail.hover()
    await page.mouse.wheel(0, 600)
    await expect.poll(() => detail.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
    await page.mouse.wheel(0, 20000)
    await expect(detail.locator('.detail-technical-meta')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    if (width <= 760) {
      await page.getByRole('button', { name: width <= 640 ? 'Назад' : 'К списку', exact: true }).click()
      await expect(list).toBeVisible()
      await expect(detail).toBeHidden()
      await expect(page).not.toHaveURL(/item=/)
    }
  })
}

test('landing uses the global game context without a page system selector', async ({ page }) => {
  await page.goto('/handbook')
  await expect(page.locator('.hb-collection-card')).toHaveCount(1)
  await expect(page.locator('.hb-sidebar')).toHaveCount(0)
  await page.locator('.hb-collection-card').click()
  await expect(page).toHaveURL(/sourceVersionId=1/)
})

test.describe('touch scrolling', () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true })

  test('vertical touch moves the detail without navigating back', async ({ page }) => {
    await page.goto('/handbook?type=6&item=1')
    const detail = page.locator('.handbook-detail')
    await detail.getByRole('button', { name: 'Описание', exact: true }).click()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 650 }] })
    for (const y of [600, 550, 450, 350, 250]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => detail.evaluate(el => el.scrollTop)).toBeGreaterThan(100)
    await expect(page).toHaveURL(/item=1/)
  })
})
