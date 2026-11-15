import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => { page.on('pageerror', error => { throw error }) })

const url = '/tests/weapon-charges/feature-actions.html'
for (const width of [390, 1280]) {
  test(`single charge preserves icon wrapping and full-width theses (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { items: [] } }))
    await page.goto(url)
    await page.waitForFunction(() => !!window.fixture)
    const description = 'Длинное описание действия продолжает обтекать иконку. '.repeat(12)
    await page.evaluate(text => {
      window.fixture.ctx.characterResources.itemsById.get('1443').data.feature_actions[0].description = `<p>${text}</p>`
    }, description)
    const row = page.locator('.dav-action').filter({ hasText: 'Адское возмездие' })
    await expect(row.locator('.dav-description')).toHaveText(description.trim())
    await page.evaluate(() => document.fonts.ready)
    const layout = await row.evaluate(element => {
      const rect = selector => {
        const { left, right, top, bottom } = element.querySelector(selector).getBoundingClientRect()
        return { left, right, top, bottom }
      }
      const range = document.createRange()
      range.selectNodeContents(element.querySelector('.dav-description p'))
      return {
        icon: rect('.dav-action-icon'), charge: rect('.dav-resource--single'),
        description: rect('.dav-description-row'), theses: rect('.mechanic-theses'),
        lines: [...range.getClientRects()].map(({ left, right, top }) => ({ left, right, top })),
      }
    })
    expect(layout.lines[0].left).toBeGreaterThan(layout.icon.right)
    const lowerLines = layout.lines.filter(line => line.top > layout.icon.bottom)
    expect(lowerLines.length).toBeGreaterThan(0)
    expect(lowerLines[0].left).toBeCloseTo(layout.icon.left, 0)
    expect(layout.lines.every(line => line.right < layout.charge.left)).toBe(true)
    expect(layout.theses.left).toBeCloseTo(layout.icon.left, 0)
    expect(layout.theses.right).toBeCloseTo(layout.charge.right, 0)
    expect(layout.theses.top).toBeGreaterThanOrEqual(layout.description.bottom)
  })

  test(`action menu covers the row, excludes charges and rolls once (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { items: [] } }))
    await page.goto(url)
    const tile = page.locator('.da-block')
    await expect(tile).toHaveClass(/base-tile/)
    await expect(tile).toHaveClass(/dav/)
    await expect(tile.locator('.morph-tile')).toHaveCount(0)
    const before = await tile.boundingBox()
    await tile.getByRole('button', { name: 'Редактировать: Действия', exact: true }).click()
    await expect(page.getByRole('dialog', {name:'Действия',exact:true})).toBeVisible()
    await expect(page.getByRole('dialog', {name:'Действия',exact:true}).locator('.dav')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', {name:'Действия',exact:true})).toHaveCount(0)
    await expect(tile).toBeVisible()
    expect(await tile.boundingBox()).toEqual(before)
    const row = page.locator('.dav-action').filter({ hasText: 'Адское возмездие' })
    for (const target of [row.locator('strong'), row.locator('.dav-description p'), row.locator('.rich-node--dice'), row.locator('.mechanic-theses li'), row.locator('.dav-action-icon')]) {
      await target.click()
      await expect(page.getByRole('menuitem', { name: /Бросить Урон огнём/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Потратить/ })).toHaveCount(0)
      await expect(page.getByTestId('rolls')).toHaveText('0')
      await page.keyboard.press('Escape')
    }
    await row.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: /Бросить Урон огнём/ }).click()
    await expect(page.getByTestId('rolls')).toHaveText('1')
    expect(await page.evaluate(() => window.fixture.dice.stack[0].result.expression)).toBe('3d10{огонь}')
    expect(await page.evaluate(() => window.fixture.resources[0].value)).toBe(1)
    await row.locator('.ss').click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    expect(await page.evaluate(() => window.fixture.resources[0].value)).toBe(0)
    // A spent charge does not prevent a damage roll; the player tracks uses separately.
    await row.locator('strong').click()
    await expect(page.getByRole('menuitem', { name: /Бросить Урон огнём/ })).toBeEnabled()
    await page.keyboard.press('Escape')
    const empty = page.locator('.dav-action').filter({ hasText: 'Только заряд' })
    await empty.click()
    await expect(page.getByRole('button', { name: 'Посмотреть источник', exact: true })).toBeVisible()
    await expect(empty).toHaveClass(/dav-action--clickable/)
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.fixture.ctx.ownerMode = false)
    await row.locator('strong').click()
    await expect(page.getByRole('button', { name: 'Посмотреть источник', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await row.locator('.ss').click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    expect(await page.evaluate(() => window.fixture.resources[0].value)).toBe(0)
  })
}

for (const width of [390, 704, 1280]) {
  test(`source action opens the original ability or item without mutations (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 932 })
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { items: [] } }))
    await page.goto(url)
    await page.waitForFunction(() => !!window.fixture)
    await page.evaluate(() => {
      window.fixture.ctx.characterResources.itemsById.set('7001', { id: 7001, typeId: 19, name: 'Булава ужаса', data: {
        activation: 'carried', attunement: 'none', desc: '<p>Описание магического источника.</p>',
        feature_actions: [{ key: 'terror', title: 'Волна ужаса', action_type: 'action', description: '<p>Существа испуганы.</p>' }],
      } })
      window.fixture.values.items = { equipped: [{ uid: 'mace', item_id: 7001, count: 1 }] }
    })
    for (const owner of [true, false]) {
      await page.evaluate(value => { window.fixture.ctx.ownerMode = value }, owner)
      for (const [title, source] of [['Только заряд', 'Дьявольское наследие'], ['Волна ужаса', 'Булава ужаса']]) {
        const row = page.locator('.dav-action').filter({ hasText: title })
        await row.focus()
        await page.keyboard.press('Enter')
        const menu = page.getByRole('menu', { name: `Действия: ${title}`, exact: true })
        await expect(menu).toBeVisible()
        await expect(menu.getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(0)
        await expect(menu.getByRole('button', { name: 'Удалить', exact: true })).toHaveCount(0)
        await expect(menu.getByRole('button', { name: 'Посмотреть источник', exact: true })).toHaveText('Источник')
        await menu.getByRole('button', { name: 'Посмотреть источник', exact: true }).click()
        const modal = page.getByRole('dialog', { name: source, exact: true })
        await expect(modal).toBeVisible()
        await expect(menu).toHaveCount(0)
        await expect(modal).toContainText(source === 'Булава ужаса' ? 'Описание магического источника.' : 'Описание источника расового действия.')
        await modal.getByRole('button', { name: 'Закрыть', exact: true }).click()
        await expect(modal).toHaveCount(0)
      }
    }
    await page.evaluate(() => { window.fixture.ctx.ownerMode = true })
    await page.locator('.dav-action').filter({ hasText: 'Своё действие' }).click()
    await expect(page.getByRole('button', { name: 'Посмотреть источник', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toBeVisible()
    expect(await page.evaluate(() => window.fixture.resources.map(row => row.value))).toEqual([1, 1])
    expect(await page.evaluate(() => window.fixture.dice.stack.length)).toBe(0)
    expect(await page.evaluate(() => window.fixture.writes)).toEqual([])
  })
}

test('derives rolls from rich dice nodes for source and custom actions, without duplicate or invalid entries', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { items: [] } }))
  await page.goto(url)
  await page.waitForFunction(() => !!window.fixture)
  const result = await page.evaluate(() => {
    const { richDescriptionRolls: parse, createRichNodeHtml: node, actions } = window.fixture
    const damage = node('dice', { formula: '2к10+3', label: 'Урон' }, '2к10+3')
    const heal = node('dice', { formula: '1d6', label: 'Лечение' }, '1к6')
    return {
      rolls: parse(`<p>${damage}${damage}${heal}${node('dice', { formula: '5' }, 'Константа')}${node('dice', { formula: 'oops' }, 'Ошибка')}${node('item', { id: 1 }, '1d8')}<span data-rich-node="dice" data-rich-payload="invalid">2d8</span></p>`),
      plain: parse('<p>2к10</p>'),
      actions: actions().map(action => ({ title: action.title, rolls: action.dice_rolls })),
    }
  })
  expect(result.rolls.map(({ formula, label }) => ({ formula, label }))).toEqual([{ formula: '2к10+3', label: 'Урон' }, { formula: '1d6', label: 'Лечение' }])
  expect(result.plain).toEqual([])
  expect(result.actions.find(action => action.title === 'Адское возмездие').rolls).toHaveLength(1)
  expect(result.actions.find(action => action.title === 'Своё действие').rolls).toHaveLength(1)
})
