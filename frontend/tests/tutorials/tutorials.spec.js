import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
})

const character = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
  hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
  STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
}, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } }
async function mockApi(page, role = 'player', entries = []) {
  const writes = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (route.request().method() !== 'GET') {
      writes.push({ path, body: route.request().postDataJSON() })
      return route.fulfill({ status: 204 })
    }
    let json = {}
    if (path === '/api/char/test') json = character
    else if (path === '/api/account/tutorials') json = { tutorials: entries }
    else if (path === '/api/sessions/test') json = { session: { uuid: 'test', name: 'Приключение', ownerUserId: role === 'dm' ? 1 : 2, systemId: 1 }, participants: [], myRole: role === 'dm' ? 'gm' : role }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    await route.fulfill({ json })
  })
  return writes
}
async function finishTour(page) {
  const card = page.locator('.guided-tour__card')
  await expect(card).toBeVisible()
  const titles = []
  for (let i = 0; i < 16; i += 1) {
    await expect(card.getByRole('button', { name: /^(Далее|Завершить)$/ })).toBeEnabled().catch(async error => {
      const detail = await page.locator('.guided-tour').evaluate(el => ({ step: el.__vueParentComponent.props.tour.step?.id, error: el.__vueParentComponent.props.tour.error?.message }))
      throw new Error(JSON.stringify(detail), { cause: error })
    })
    await expect(card.getByRole('alert')).toHaveCount(0)
    titles.push(await card.locator('h2').innerText())
    const done = card.getByRole('button', { name: 'Завершить', exact: true })
    if (await done.count()) { await done.click(); await expect(card).toHaveCount(0); return titles }
    await card.getByRole('button', { name: 'Далее', exact: true }).click()
  }
  throw new Error('Tour did not finish')
}
for (const mobile of [false, true]) {
  test(`character ${mobile ? 'mobile' : 'desktop'} completes real page without game mutations`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
    const writes = await mockApi(page)
    await page.goto('/tests/tutorials/fixtures/tutorials.html')
    const titles = await finishTour(page)
    expect(titles).toContain('Управление здоровьем')
    expect(writes).toEqual([{ path: '/api/account/tutorials', body: { flowId: 'character', sourceKey: 'edition:1', device: mobile ? 'mobile' : 'desktop', revision: 1, status: 'completed' } }])
    await expect(page.locator('[data-tutorial="character-hp-editor"]')).toHaveCount(0)
  })
  for (const role of ['player', 'dm']) test(`session ${role} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
    const writes = await mockApi(page, role)
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test')
    await finishTour(page)
    expect(writes.filter(write => write.path === '/api/account/tutorials')).toEqual([{ path: '/api/account/tutorials', body: { flowId: `session-${role}`, sourceKey: 'source:1', device: mobile ? 'mobile' : 'desktop', revision: 1, status: 'completed' } }])
    expect(writes.filter(write => write.path !== '/api/account/tutorials')).toEqual([])
  })
}
test('seen device stays quiet, another device starts; leaving cancels without recording completion', async ({ page }) => {
  const writes = await mockApi(page, 'player', [{ flowId: 'character', sourceKey: 'edition:1', device: 'desktop', revision: 1, status: 'completed' }])
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.locator('[data-tutorial="character-hp"]')).toBeVisible()
  await expect(page.locator('.guided-tour')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.guided-tour')).toBeVisible()
  await page.evaluate(() => window.tutorialNavigateAway())
  await expect(page.locator('.guided-tour')).toHaveCount(0)
  expect(writes).toEqual([])
})

test('settings restart a dismissed tour and Escape records only dismissal', async ({ page }) => {
  const writes = await mockApi(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.locator('.guided-tour')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.guided-tour')).toHaveCount(0)
  expect(writes[0].body.status).toBe('dismissed')
  await page.locator('.sm-tile').click()
  await page.getByRole('button', { name: 'Пройти обучение снова' }).click()
  await expect(page.locator('.guided-tour__card h2')).toHaveText('Ваш лист персонажа')
})
test('failed save stays retryable and can be closed without trapping the player', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/account/tutorials', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { desc: 'offline' } }) : route.fallback())
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await page.locator('.guided-tour').getByRole('button', { name: 'Пропустить' }).click()
  await expect(page.locator('.guided-tour').getByRole('alert')).toBeVisible()
  await page.locator('.guided-tour').getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(page.locator('.guided-tour')).toHaveCount(0)
})
test('account reset affects only the selected source and device', async ({ page }) => {
  const first = { flowId: 'character', sourceKey: 'edition:1', device: 'desktop', revision: 1, status: 'completed' }
  const second = { ...first, device: 'mobile' }
  const writes = await mockApi(page, 'player', [first, second])
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/account-tutorials')
  await expect(page.getByRole('button', { name: 'Показать снова', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Показать снова', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Показать снова', exact: true })).toHaveCount(1)
  expect(writes).toEqual([{ path: '/api/account/tutorials/reset', body: { flowId: first.flowId, sourceKey: first.sourceKey, device: first.device } }])
  await expect(page.getByText('DND5e · 2014 · Телефон', { exact: true })).toBeVisible()
})
