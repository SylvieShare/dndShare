import { expect, test } from '@playwright/test'

const editions = [{ id: 1, version: '2014' }, { id: 1799, version: '2024' }]
const classes = [
  { id: 4021, name: 'Паладин', edition: 1 }, { id: 4016, name: 'Бард', edition: 1 },
  { id: 6939, name: 'Паладин', edition: 1799 }, { id: 6901, name: 'Бард', edition: 1799 },
]
const spellType = { id: 5, sourceId: 1, name: 'Заклинания', fields: [
  { key: 'lvl', name: 'Уровень', type: 'int', filter: true, filter_values: [0, 1] },
  { key: 'classes', name: 'Классы', type: 'object_array', filter: true,
    filter_path: 'classes.id', filter_item_type: 9, fields: [{ key: 'id', type: 'item', item_type: 9 }] },
] }

async function mockCatalogue(page) {
  const requests = []
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    let json = {}
    if (url.pathname === '/api/user/checkAuth') json = { auth: false }
    if (url.pathname === '/api/sources') json = { sources: [{ id: 1, name: 'D&D 5e', versions: editions }] }
    if (url.pathname === '/api/item-types') json = { types: [spellType] }
    if (url.pathname === '/api/content-sources') json = { sources: [{ id: 15, name: 'Другая книга' }] }
    if (url.pathname === '/api/items' || url.pathname === '/api/items/search') {
      const typeId = Number(url.searchParams.get('typeId'))
      const edition = Number(url.searchParams.get('sourceVersionId'))
      if (typeId === 9) {
        requests.push(url)
        // The old, unscoped request returns both editions, reproducing the bug.
        json = { items: classes.filter(item => !edition || item.edition === edition) }
      } else {
        const classId = classes.find(item => item.edition === edition && item.name === 'Паладин')?.id
        const filters = JSON.parse(url.searchParams.get('filters') || '{}')
        json = { items: [{ id: 863, name: filters['classes.id']?.includes(classId) ? 'Выбран паладин' : 'Заклинание',
          typeId: 5, data: { lvl: 1, classes: [{ id: classId }] } }] }
      }
    }
    await route.fulfill({ json })
  })
  return requests
}

for (const width of [390, 834, 1440]) {
  for (const edition of editions) {
    for (const picker of [false, true]) {
      test(`${picker ? 'picker' : 'collection'} has one class per name in ${edition.version} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        const requests = await mockCatalogue(page)
        await page.goto(picker
          ? `/tests/handbook/fixture.html?edition=${edition.id}`
          : `/handbook/objects?type=5&sourceVersionId=${edition.id}`)
        await expect.poll(() => requests.length).toBeGreaterThan(0)
        await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
        const group = page.locator('.col-filter-group').filter({ has: page.locator('.col-filter-title', { hasText: /^Классы$/ }) })
        await expect(group.getByRole('button', { name: 'Паладин', exact: true })).toHaveCount(1)
        await expect(group.getByRole('button', { name: 'Бард', exact: true })).toHaveCount(1)
        await expect(group.locator('.col-filter-chip')).toHaveCount(2)
        for (const request of requests) {
          expect(request.searchParams.get('sourceVersionId')).toBe(String(edition.id))
          expect(request.searchParams.has('contentSourceIds')).toBe(false)
        }
        const classId = classes.find(item => item.edition === edition.id && item.name === 'Паладин').id
        await group.getByRole('button', { name: 'Паладин', exact: true }).click()
        await expect(page.locator('.list-row').first()).toContainText('Выбран паладин')
        await expect(group.getByRole('button', { name: 'Паладин', exact: true })).toHaveAttribute('aria-pressed', 'true')
        const filters = page.url().includes('/handbook/objects') ? JSON.parse(new URL(page.url()).searchParams.get('filters')) : null
        if (filters) expect(filters['classes.id']).toEqual([classId])
        if (width === 390 && edition.id === 1) await page.screenshot({ path: test.info().outputPath(picker ? 'picker.png' : 'collection.png') })
      })
    }
  }
}
