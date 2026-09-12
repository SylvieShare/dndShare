import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => { page.on('pageerror', error => { throw error }) })

const url = '/tests/weapon-charges/feature-actions.html'
for (const width of [390, 1280]) {
  test(`action menu covers the row, excludes charges and rolls once (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('http://127.0.0.1:5176/api/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto(url)
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
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(empty).not.toHaveClass(/dav-action--clickable/)
    await page.evaluate(() => window.fixture.ctx.ownerMode = false)
    await row.locator('strong').click()
    await row.locator('.ss').click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    expect(await page.evaluate(() => window.fixture.resources[0].value)).toBe(0)
  })
}

test('derives rolls from rich dice nodes for source and custom actions, without duplicate or invalid entries', async ({ page }) => {
  await page.route('http://127.0.0.1:5176/api/**', route => route.fulfill({ json: { items: [] } }))
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
