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
      const selectedStates = JSON.parse(process.env.DNDSHARE_REVIEW_STATES || '[]')
      if (selectedStates.length && !selectedStates.includes(state)) return
      await page.mouse.move(format.width - 1, format.height - 1)
      await settle(page)
      const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, unit: 'px' }))
      expect(dimensions).toEqual({ width: format.width, height: format.height, unit: 'px' })
      const file = `web/${format.name}-${state}.png`
      const buffer = await page.screenshot({ path: path.join(output, file), fullPage: false })
      entries.push({ platform: 'web', format: format.name, state, file, dimensions,
        viewport: { width: format.width, height: format.height, unit: 'CSS px' },
        recordID: state === 'record' ? fixture.recordID : null,
        characterUUID: state.startsWith('sheet-') ? fixture.characters[0].uuid : state === 'vtm-base' ? fixture.characters[1].uuid : null,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        browserVersion: browser.version(), apiRequests: [...apiRequests],
      })
    }

    const selectedStates = JSON.parse(process.env.DNDSHARE_REVIEW_STATES || '[]')
    const wanted = new Set(selectedStates.length ? selectedStates : matrix.states)
    if (['collections','menu','list','record'].some(state => wanted.has(state))) {
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
    await expect(page.locator('.handbook-heading-name:visible')).toHaveText('Заклинания')
    await expect(page.locator('.handbook-col-bar .col-type-count')).toHaveCount(0)
    await expect(page.locator('.handbook-list .list-row').filter({ hasText: fixture.recordName })).toBeVisible()
    await snapshot('list')
    await page.locator('.handbook-list .list-row').filter({ hasText: fixture.recordName }).click()
    await expect(page.locator('.handbook-detail h1')).toHaveText(fixture.recordName)
    await expect(page.locator('.item-detail-cover')).toBeVisible()
    await snapshot('record')
    }
    if (wanted.has('character-list')) {
      await page.goto('/chars', { waitUntil: 'networkidle' })
      await expect(page.getByPlaceholder('Найти персонажа')).toBeVisible()
      await snapshot('character-list')
    }
    const dnd = fixture.characters[0], vtm = fixture.characters[1]
    if (['sheet-base','sheet-death-saves','sheet-stats','sheet-stat-editor','sheet-weapons','sheet-magic','sheet-inventory','sheet-personality'].some(state => wanted.has(state))) {
    await page.goto(`/char/${dnd.uuid}`, { waitUntil: 'networkidle' })
    if (format.name !== 'wide') await expect(page.locator('.dnd-tablet-base')).toBeVisible()
    else await expect(page.locator('[data-tutorial="character-stat"]:visible').first()).toBeVisible({ timeout: 30000 })
    await snapshot('sheet-base')
    if (wanted.has('sheet-death-saves')) {
      if (format.name !== 'phone') await expect(page.getByRole('button', { name: 'Успехи: 3', exact: true })).toBeVisible()
      await snapshot('sheet-death-saves')
    }
    if (['sheet-stats','sheet-stat-editor'].some(state => wanted.has(state))) {
    if (format.name !== 'wide') await page.getByRole('navigation', { name: format.name === 'phone' ? 'Вкладки персонажа' : 'Раздел персонажа' }).getByRole('button', { name: 'Статы', exact: true }).click()
    await expect(page.locator('.dnd-stats:visible')).toBeVisible()
    await snapshot('sheet-stats')
    if (wanted.has('sheet-stat-editor')) {
    await page.locator('[data-tutorial="character-stat"]:visible').first().getByRole('button', { name: 'Редактировать: Сила', exact: true }).click()
    await expect(page.getByText('Основное значение', { exact: true })).toBeVisible()
    await snapshot('sheet-stat-editor')
    await page.keyboard.press('Escape')
    await expect(page.getByText('Основное значение', { exact: true })).not.toBeVisible()
    }
    }
    if (wanted.has('sheet-weapons')) {
      await page.getByRole(format.name === 'wide' ? 'tab' : 'button', { name: 'Оружие', exact: true }).last().click()
      await expect(page.getByText('Посох молнии', { exact: true }).first()).toBeVisible()
      await snapshot('sheet-weapons')
    }
    if (wanted.has('sheet-inventory')) {
      await page.getByRole(format.name === 'wide' ? 'tab' : 'button', { name: format.name === 'wide' ? 'Снаряжение' : 'Предметы', exact: true }).last().click()
      await expect(page.locator('.inventory-bag-grid').first()).toBeVisible()
      await snapshot('sheet-inventory')
    }
    if (wanted.has('sheet-personality')) {
      await page.getByRole(format.name === 'wide' ? 'tab' : 'button', { name: 'Личность', exact: true }).last().click()
      await expect(page.getByText('Странница', { exact: true }).first()).toBeVisible()
      await snapshot('sheet-personality')
    }
    if (wanted.has('sheet-magic')) {
      await page.getByRole(format.name === 'wide' ? 'tab' : 'button', { name: 'Магия', exact: true }).last().click()
      await expect(page.getByText('Ячейки заклинаний', {exact:true}).first()).toBeVisible()
      await snapshot('sheet-magic')
    }
    }
    if (wanted.has('vtm-base')) {
    await page.goto(`/char/${vtm.uuid}`, { waitUntil: 'networkidle' })
    await expect(page.getByText(vtm.name, { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Меню персонажа', exact: true }).click()
    await expect(page.getByText('Получить PDF', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Получить PDF', { exact: true })).not.toBeVisible()
    await snapshot('vtm-base')
    }
    expect(errors).toEqual([])
    expect(external).toEqual([])
    expect(apiRequests.some(request => request.startsWith('/api/items'))).toBe(true)
    writeFileSync(path.join(output, `web-${format.name}.json`), JSON.stringify(entries, null, 2))
  })
}
