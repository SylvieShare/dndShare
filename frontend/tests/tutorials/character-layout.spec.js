import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function openHeaderAction(page, name) {
  await page.getByRole('button', { name: 'Действия персонажа', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

for (const width of [600, 834, 1100]) test(`tablet sheet uses a shared header and balanced stats at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const nav = page.getByRole('navigation', { name: 'Раздел персонажа' })
  await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', {name: 'Меню персонажа', exact:true})).toBeVisible()
  await expect(page.locator('[data-tutorial="character-hp"]')).toBeVisible()
  await nav.getByRole('button', { name: 'Статы', exact: true }).click()
  await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  const stats = page.locator('.dnd-stats:visible')
  await expect(stats.locator('[data-sheet-field]')).toHaveCount(6)
  const columns = await stats.locator('[data-sheet-field]').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().x))).size)
  expect(columns).toBe(width === 600 ? 1 : width === 834 ? 2 : 3)
  const boxes = await stats.locator('[data-sheet-field]').evaluateAll(nodes => nodes.map(node => ({ x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right })))
  const outer = await stats.boundingBox()
  expect(Math.min(...boxes.map(box => box.x))).toBeCloseTo(outer.x, 0)
  expect(Math.max(...boxes.map(box => box.right))).toBeCloseTo(outer.x + outer.width, 0)
  await nav.getByRole('button', { name: 'Магия', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.tutorialRoute())).toContain('tab=spells')
  await page.evaluate(() => window.characterHistoryBack())
  await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})

test('fold resizing retains semantic sections and editable character data', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Магия', exact: true }).click()
  for (const width of [390, 1100, 1440, 834]) {
    await page.setViewportSize({ width, height: 1100 })
    await expect(page.locator('[data-sheet-section="spells"]:visible')).toHaveCount(1)
  }
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Статы', exact: true }).click()
  await page.getByRole('button', { name: 'Редактировать: Сила', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Сила', exact: true })).toBeVisible()
  expect(api.document().values.hp.current).toBe(18)
  expect(api.writes).toEqual([])
})

for (const width of [390, 834, 1440]) test(`VTM uses native composition at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  await fixture(page, 'VTM20')
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.getByText('Алекс', { exact: true }).first()).toBeVisible()
  await expect.poll(() => page.locator('[data-sheet-field="clan"]:visible').evaluate(node => node.textContent.includes('Тореадор') || [...node.querySelectorAll('input')].some(input => input.value === 'Тореадор'))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
})

for (const width of [390, 834, 1440]) test(`health and sheet actions remain reachable at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const heading = page.locator('.dnd-heading')
  await expect(heading.locator('.heading-health')).toHaveText('18 / 23')
  if (width < 1200) {
    const scroller = page.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
    await scroller.evaluate(el => { el.scrollTop = 180 })
    await expect(page.locator('.character-summary-strip')).toHaveCount(0)
    await expect(page.getByRole('button', {name:'Сводка персонажа',exact:true})).toHaveCount(0)
    await expect(heading).toBeInViewport()
  } else {
    await expect(page.locator('.dnd-desktop-main [data-sheet-field="hp"]')).toHaveCount(0)
    await expect(page.locator('.dnd-desktop-utilities [data-sheet-field="rest"]')).toHaveCount(0)
  }
  await expect(heading.locator('.portrait-xp')).toHaveCount(0)
  const header = page.locator('.character-workspace-header')
  await header.getByRole('button', {name:'Отдых и рассвет',exact:true}).click()
  await expect(page.getByRole('menuitem', {name:'Короткий отдых'})).toBeVisible()
  await page.keyboard.press('Escape')
  await header.getByRole('button', {name:'Меню персонажа',exact:true}).click()
  await expect(page.locator('[data-tutorial="character-menu"]:visible')).toBeVisible()
  await page.keyboard.press('Escape')
  await openHeaderAction(page, 'Изменить HP')
  await expect(page.locator('[data-tutorial="character-hp-editor"]')).toBeVisible()
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  expect(api.writes).toEqual([])
})

for (const owner of [false, true]) test(`zero HP opens death saves with the sheet permissions (owner=${owner})`, async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  const api = await fixture(page, 'DND5', owner)
  Object.assign(api.document().values.hp, {current:0,ds_success:1,ds_failure:2})
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await openHeaderAction(page, owner ? 'Изменить HP' : 'Здоровье')
  const panel = page.getByRole('dialog', {name:'Здоровье',exact:true})
  if (owner) {
    await expect(panel.getByRole('button',{name:'Провалы: 2'})).toHaveAttribute('aria-pressed','true')
    await expect(panel.getByRole('button',{name:'Урон',exact:true})).toBeVisible()
  } else {
    await expect(panel.getByText('2 / 3')).toBeVisible()
    await expect(panel.getByRole('button',{name:'Изменить здоровье'})).toHaveCount(0)
  }
  expect(api.writes).toEqual([])
})

test.describe('compact character gestures', () => {
  test.use({ hasTouch: true })

  async function swipe(page, { reverse = false, vertical = false } = {}) {
    const { width, height } = page.viewportSize()
    const client = await page.context().newCDPSession(page)
    const start = { x: Math.round(width * (reverse ? .2 : .8)), y: height - 180 }
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (const part of [.2, .4, .6, .8, 1]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: vertical ? start.x : Math.round(start.x + width * (reverse ? .6 : -.6) * part),
        y: start.y - (vertical ? 200 * part : 0),
      }] })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
    await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
  }

  for (const width of [390, 834]) test(`page swipes both ways and keeps vertical scrolling at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const api = await fixture(page)
    await page.goto('/tests/tutorials/fixtures/tutorials.html')
    const nav = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа' })
    await expect(page.locator('.character-workspace-header')).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('button', {name: 'Меню персонажа', exact:true})).toBeVisible()
    await swipe(page, { vertical: true })
    if (width < 600) await expect.poll(() => page.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll').evaluate(node => node.scrollTop)).toBeGreaterThan(0)
    await expect(page.locator('[data-tutorial="character-hp"]:visible')).toHaveCount(1)
    await swipe(page)
    await expect(nav.getByRole('button', { name: 'Оружие', exact: true })).toHaveAttribute('aria-current', 'page')
    await swipe(page, { reverse: true })
    await expect(nav.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('button', { name: 'Статы', exact: true }).click()
    await nav.getByRole('button', { name: 'Магия', exact: true }).click()
    await expect(nav.getByRole('button', { name: 'Магия', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(api.writes).toEqual([])
  })

  test('modal tablet sheet uses the same swipe pager', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1100 })
    await page.goto('/tests/tutorials/fixtures/character-sheet-save.html')
    await expect(page.locator('.dnd-heading .identity strong')).toHaveText('Торин')
    const modal = await page.locator('.csm').boundingBox()
    const tabs = await page.locator('.csm-tabs').boundingBox()
    expect(tabs.width).toBeLessThan(modal.width - 24)
    expect(tabs.x + tabs.width / 2).toBeCloseTo(modal.x + modal.width / 2, 0)
    await swipe(page)
    await expect(page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Оружие', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-sheet-section="weapons"]:visible')).toBeVisible()
  })
})

for (const width of [390, 834, 1440]) test(`all sheet tabs are retained before direct selection at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1100 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const panes = page.locator(width < 1200 ? '.mobile-swipe-pane .character-sheet' : '.inner-tab-pane')
  await expect(panes).toHaveCount(width < 1200 ? 7 : 6, { timeout: 20000 })
  if (width >= 1200) await expect(page.locator('.inner-tab-pane .sheet-skeleton')).toHaveCount(0)
  await panes.evaluateAll(nodes => nodes.forEach((node, index) => { node.dataset.retainedIdentity = 'pane-' + index }))
  if (width < 600) await page.getByRole('button', { name: 'Дневник', exact: true }).click()
  else if (width < 1200) await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Дневник', exact: true }).click()
  else await page.locator('.dnd-desktop-main').getByRole('tab', { name: 'Дневник', exact: true }).click()
  await expect.poll(() => panes.evaluateAll(nodes => nodes.map(node => node.dataset.retainedIdentity))).toEqual(Array.from({ length: width < 1200 ? 7 : 6 }, (_, index) => 'pane-' + index))
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})

test('prepared inventory keeps real sections visible and replaces only a pending item', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1100 })
  const api = await fixture(page)
  api.document().values.items = { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'ready-staff', item_id: 206, count: 1 }], slots: {} }] }
  let release
  const waiting = new Promise(resolve => { release = resolve })
  await page.route('**/api/items/by-ids?*', async route => {
    await waiting
    await route.fulfill({ json: { items: [{ id: 206, typeId: 2, name: 'Учебный посох', data: { weight: 1 } }] } })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Предметы', exact: true }).click()
  const inventory = page.locator('[data-sheet-section="inventory"]:visible')
  await expect(inventory.getByRole('button', { name: 'Рюкзак', exact: true })).toBeVisible()
  await expect(inventory.locator('.inventory-bag-grid')).toBeVisible()
  await expect(inventory.locator('.share-skeleton')).toBeVisible()
  release()
  await expect(inventory.getByRole('button', { name: 'Учебный посох', exact: true })).toBeVisible()
  await expect(inventory.locator('.share-skeleton')).toHaveCount(0)
  expect(api.writes).toEqual([])
})

test('sheet header uses the character icon before the portrait and handles missing images', async ({ page }) => {
  const api = await fixture(page)
  let iconImageUrl = '/static/tab-stats.svg'
  api.document().values.ava = { url: '/static/tab-personality.svg' }
  await page.route('**/api/char/test', route => route.fulfill({ json: {
    templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1,
    data: api.document(), iconImageUrl,
  } }))
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const icon = page.locator('.dnd-heading .portrait')
  await expect(icon.locator('img')).toHaveAttribute('src', '/static/tab-stats.svg')
  iconImageUrl = null
  await page.reload()
  await expect(icon.locator('img')).toHaveAttribute('src', '/static/tab-personality.svg')
  api.document().values.ava.url = '/missing-character-image.png'
  await page.reload()
  await expect(icon.locator('img')).toHaveCount(0)
  await expect(icon).toHaveText('Л')
  expect(api.writes).toEqual([])
})

for (const width of [390, 834, 1440]) test(`sheet content scrolls behind sharp chrome at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 })
  const api = await fixture(page)
  api.document().values.name = 'Лира с очень длинным именем персонажа '.repeat(5)
  api.document().values.race = { name: 'Полуэльф с длинным названием происхождения '.repeat(5) }
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const header = page.locator('.character-workspace-header')
  await expect(header).toBeVisible()
  await expect(header.locator('.portrait')).toHaveText('Л')
  const identity = await header.locator('.dnd-heading').boundingBox()
  const icon = await header.locator('.dnd-heading .portrait').boundingBox()
  const name = await header.locator('.identity strong').boundingBox()
  expect(icon.x + icon.width).toBeLessThan(name.x)
  expect(name.x + name.width).toBeLessThanOrEqual(identity.x + identity.width + 1)
  await expect.poll(() => page.locator('.view').evaluate(element =>
    parseFloat(getComputedStyle(element).getPropertyValue('--sheet-chrome-height')))).toBeGreaterThan(60)
  const viewport = page.locator('.sheet-scroll')
  expect((await viewport.boundingBox()).y).toBeCloseTo((await page.locator('.view').boundingBox()).y, 0)
  if (width < 1200) {
    const button = page.getByRole('button', { name: 'Статы', exact: true })
    await button.click()
    await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/settling/)
  }
  const scroller = width < 1200 ? page.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll') : viewport
  await expect(scroller).toBeVisible()
  await expect.poll(() => scroller.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(20)
  const before = await header.boundingBox()
  await scroller.evaluate(element => { element.scrollTop = 200 })
  expect(await scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(20)
  expect((await header.boundingBox()).y).toBeCloseTo(before.y, 0)
  await expect(header).toHaveCSS('filter', 'none')
})

for (const width of [390, 834, 1440]) test(`focused stat editor saves input immediately at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  if (width < 600) await page.getByRole('button', { name: 'Статы', exact: true }).click()
  else if (width < 1200) await page.getByRole('navigation', { name: 'Раздел персонажа' }).getByRole('button', { name: 'Статы', exact: true }).click()
  await expect(page.locator('.save-chip').first()).toHaveCSS('border-top-width', '0px')
  await expect(page.locator('.skill-chip').first()).toHaveCSS('border-top-width', '0px')
  await page.getByRole('button', { name: 'Редактировать: Сила', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Сила', exact: true })
  await expect(form).toBeVisible()
  await expect(form.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Отмена', exact: true })).toHaveCount(0)
  await expect(form.locator('.fn-wrap').first()).toHaveCSS('box-shadow', /0px 0px 0px 0px/)
  await form.locator('.fn-input').first().fill('14')
  await expect.poll(() => api.document().values.STR.value.base).toBe(14)
  await expect(form.getByText('Владение спасброском')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(form).toHaveCount(0)
  await page.getByRole('button', { name: 'Сила — спасбросок', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Изменить' }).click()
  await page.getByRole('switch', { name: 'Владение спасброском' }).click()
  await expect.poll(() => api.document().values.STR.save_up).toBe(true)
})


test('resize keeps loaded catalogue and current section without refetch', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 })
  const api = await fixture(page, 'DND5', true, true)
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  await expect(page.getByText('Кешированный посох', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.inner-tab-pane .sheet-skeleton')).toHaveCount(0)
  // Visit all data-owning sections before measuring resize-only requests.
  for (const label of ['Магия', 'Способности', 'Снаряжение', 'Оружие']) {
    await page.locator('.dnd-desktop-main').getByRole('tab', { name: label, exact: true }).click()
  }
  await expect(page.getByText('Кешированный посох', { exact: true }).first()).toBeVisible()
  await page.waitForTimeout(500)
  const count = () => api.requests.filter(path => path === '/api/items/by-ids' || path === '/api/char/test').length
  const before = count()
  for (const width of [834, 390, 1440, 834, 1920]) {
    await page.setViewportSize({ width, height: 1100 })
    await expect(page.getByText('Кешированный посох', { exact: true }).first()).toBeVisible()
    await expect(page.locator('.character-loading')).toHaveCount(0)
    await page.waitForTimeout(300)
    expect(count()).toBe(before)
  }
  expect(api.writes).toEqual([])
})



for (const width of [390, 834, 1440]) test(`sheet header is opaque at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await fixture(page)
  await page.goto('/tests/tutorials/fixtures/tutorials.html?fullApp')
  const header = page.locator('.character-workspace-header')
  await expect(header).toBeVisible()
  await expect(header).toHaveCSS('background-color', 'rgb(23, 23, 27)')
  await expect(header.locator('.workspace-header-backdrop')).toHaveCount(0)
  await expect(header.locator('.identity small')).toHaveText('3 ур.')
  await expect(page.locator('.character-summary-strip')).toHaveCount(0)
  const geometry = await page.locator('.dnd-heading').evaluate(node => {
    const root = node.getBoundingClientRect(), image = node.querySelector('.portrait').getBoundingClientRect()
    const hp = node.querySelector('.heading-health').getBoundingClientRect(), css = getComputedStyle(node.querySelector('.heading-health'))
    return { left: hp.left - image.left, right: root.right - hp.right, icon: image.width, hpHeight: hp.height, border: css.borderTopWidth, radius: parseFloat(css.borderTopLeftRadius) }
  })
  expect(Math.abs(geometry.left)).toBeLessThan(1)
  expect(Math.abs(geometry.right)).toBeLessThan(1)
  expect(geometry.icon).toBe(48)
  expect(geometry.hpHeight).toBeGreaterThanOrEqual(16)
  expect(geometry.border).toBe('1px')
  expect(geometry.radius).toBeGreaterThan(0)
  await testInfo.attach('character-header', { body: await header.screenshot(), contentType: 'image/png' })
})

for (const width of [390, 834, 1440]) test(`header menu edits character HP and experience without morphs at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  api.document().values.WIS.skills['10'] = { up: 1, bonuses: [] }
  api.document().values.INT.skills['5'] = { up: 2, bonuses: [] }
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const heading = page.locator('.dnd-heading')
  await expect(heading.locator('[title="Пассивное внимание"]')).toHaveText('15')
  await expect(heading.locator('[title="Пассивное расследование"]')).toHaveText('16')
  await openHeaderAction(page, 'Изменить персонажа')
  const identity = page.getByRole('dialog', { name: 'Персонаж', exact: true })
  await identity.getByPlaceholder('Имя персонажа').fill('Новая Лира')
  await identity.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(heading.locator('.identity strong')).toHaveText('Новая Лира')
  await openHeaderAction(page, 'Изменить HP')
  const health = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  await health.getByRole('button', { name: '4', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.heading-health')).toHaveText('14 / 23')
  await page.keyboard.press('Escape')
  await expect(health).toHaveCount(0)
  await page.getByRole('button', { name: 'Действия персонажа', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Прогресс уровня' })).toBeVisible()
  await page.getByRole('menuitem', { name: /Опыт/ }).click()
  const experience = page.getByRole('dialog', { name: 'Опыт', exact: true })
  await experience.getByRole('button', { name: '1', exact: true }).click()
  await experience.getByRole('button', { name: '0', exact: true }).click()
  await experience.getByRole('button', { name: '+ 10 опыт', exact: true }).click()
  await expect.poll(() => api.document().values.lvl.exp).toBe(710)
  await expect.poll(() => api.document().values.hp.current).toBe(14)
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
})

for (const width of [390, 834, 1440]) test(`active header conditions have their own menu at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const api = await fixture(page)
  api.document().values.inspiration = true
  await page.goto('/tests/tutorials/fixtures/tutorials.html')
  const strip = page.locator('.character-summary-strip')
  const status = strip.getByRole('button', { name: 'Вдохновение', exact: true })
  await expect(status).toBeVisible()
  await expect(status.locator('svg')).toBeVisible()
  expect((await status.boundingBox()).width).toBeLessThan(200)
  await status.click()
  await page.getByRole('menuitem', { name: 'Убрать', exact: true }).click()
  await expect(strip).toHaveCount(0)
  await expect.poll(() => api.document().values.inspiration).toBe(false)
  await openHeaderAction(page, 'Добавить состояние')
  await expect(page.getByRole('dialog', { name: 'Эффекты и состояния', exact: true })).toBeVisible()
  await expect(page.locator('.mes-editor')).toHaveCount(0)
})
