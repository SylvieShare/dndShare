import { expect, test } from '@playwright/test'

const emblem = 'https://storage.example.test/collection.svg'
const sources = [{ id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }]
const type = (id, name, extra = {}) => ({
  id, name, sourceId: 1, countItems: 42, fields: [], description: 'Справочные записи',
  iconImageUrl: emblem, ...extra,
})
const types = [
  type(1, 'Оружие'), type(2, 'Вещи'), type(5, 'Заклинания'), type(6, 'Бестиарий'),
  type(3, 'Расовые способности'), type(4, 'Классовые способности'), type(7, 'Черты'),
  type(16, 'Подрасы'), type(17, 'Подклассы'), type(18, 'Сюжетные способности', { countItems: 0 }),
  type(30, 'Транспорт'), type(31, 'Наземный', { parentTypeId: 30 }),
]

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(emblem, route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="40" fill="white"/></svg>' }))
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    const json = {
      '/api/sources': { sources }, '/api/item-types': { types },
      '/api/suggest/types': { items: [{ id: 2, name: 'Школы магии', countItems: 8 }] },
      '/api/user/checkAuth': { auth: false }, '/api/items': { items: [] },
    }[path] || {}
    return route.fulfill({ json })
  })
  await page.goto('/handbook')
  await expect(page.locator('.hb-collection-card')).toHaveCount(9)
})

test('keeps groups, dictionaries and collection navigation without aggregate or editing controls', async ({ page }) => {
  const landing = page.locator('.hb-landing')
  await expect(landing.locator('.hb-collection-group-title')).toHaveText([
    'Основные разделы', 'Способности и черты', 'Транспорт',
  ])
  await expect(landing.getByText('Все записи', { exact: true })).toHaveCount(0)
  await expect(landing.getByText(/только чтение|\d+ коллекций/)).toHaveCount(0)
  await expect(landing.getByText('Коллекции', { exact: true })).toHaveCount(0)
  await expect(landing.getByRole('button', { name: /Создать|Добавить|Редактировать/ })).toHaveCount(0)
  for (const name of ['Подрасы', 'Подклассы', 'Сюжетные способности']) {
    await expect(landing.locator('.hb-collection-card').filter({ hasText: name })).toHaveCount(0)
  }
  await expect(landing.locator('.hb-card-children')).toHaveText('Подразделы: Наземный')
  await expect(landing.locator('.hb-dict-card')).toHaveAttribute('href', '/handbook/dictionary?type=2')
  await landing.locator('.hb-collection-card').filter({ hasText: 'Оружие' }).click()
  await expect(page).toHaveURL(/type=1(?:&|$)/)
  await expect(page).toHaveURL(/sourceVersionId=1/)
})

test('uses one, two or three columns at the available landing width, including insets', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 })
  const landing = page.locator('.hb-landing')
  const grid = landing.locator('.hb-collections-grid').first()
  for (const [width, columns] of [[320, 1], [599, 1], [600, 2], [1199, 2], [1200, 3], [1400, 3]]) {
    await landing.evaluate((el, width) => {
      const content = el.querySelector('.hb-content')
      const style = getComputedStyle(content)
      const insets = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
        .reduce((sum, key) => sum + parseFloat(style[key]), 0)
      el.style.width = `${width + insets}px`
      el.style.maxWidth = 'none'
      el.style.flexShrink = '0'
    }, width)
    await expect.poll(() => grid.evaluate(el => el.getBoundingClientRect().width)).toBe(width)
    await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns)
    const bounds = await grid.boundingBox()
    for (const card of await grid.locator('.hb-collection-card').all()) {
      const box = await card.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
    }
  }
})

test('shows the landing title only on desktop alongside the compact app page header', async ({ page }) => {
  for (const width of [390, 600, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const title = page.locator('.hb-header h1')
    if (width < 1200) await expect(title).toBeHidden()
    else await expect(title).toBeVisible()
  }
})

test('keeps the compact composition and grows for enlarged text without covering the emblem', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const card = page.locator('.hb-collection-card').filter({ hasText: 'Оружие' })
  const icon = card.locator('.hb-card-icon')
  await expect.poll(() => icon.evaluate(el => el.naturalWidth)).toBe(96)
  await expect(card).toHaveCSS('height', '160px')
  await expect(card.locator('.hb-card-name')).toHaveCSS('font-size', '22px')
  await expect(card.locator('.hb-card-desc')).toHaveCSS('font-size', '12px')
  await expect(card.locator('.hb-card-count-num')).toHaveCSS('font-size', '32px')
  await expect(icon).toHaveCSS('width', '96px')
  await expect(icon).toHaveCSS('height', '96px')
  await card.locator('.hb-card-top > *, .hb-card-count > *').evaluateAll(elements => {
    for (const el of elements) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`
  })
  expect((await card.boundingBox()).height).toBeGreaterThan(160)
  const iconBox = await icon.boundingBox()
  for (const selector of ['.hb-card-top', '.hb-card-bottom']) {
    const textBox = await card.locator(selector).boundingBox()
    expect(textBox.x + textBox.width - 118).toBeLessThanOrEqual(iconBox.x)
  }
  expect(await card.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
