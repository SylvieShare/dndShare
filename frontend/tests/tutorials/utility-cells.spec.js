import { expect, test } from '@playwright/test'

test('all grouped utility cells share hover, padding and full-cell activation', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/tests/tutorials/fixtures/utility-cells.html')
  const grid = page.locator('.layout-table')
  const cells = grid.locator('.utility-cell')
  await expect(cells).toHaveCount(6)
  await expect(grid.locator('.base-tile, .morph-tile-pencil, .stf-roll')).toHaveCount(0)
  const hoverColor = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--surface-raised)'
    document.body.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  })
  const gridBox = await grid.boundingBox()
  for (const [index, cell] of (await cells.all()).entries()) {
    const box = await cell.boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(69)
    expect(box.height).toBeLessThanOrEqual(70)
    expect(box.y + box.height).toBeLessThanOrEqual(gridBox.y + (Math.floor(index / 3) + 1) * 70)
    expect(await cell.evaluate(el => getComputedStyle(el).paddingBottom)).toBe('12px')
    await cell.hover()
    await expect(cell).toHaveCSS('background-color', hoverColor)
  }
  for (const [name, selector] of [['КД', '.mes-editor'], ['Скорость', '.mes-editor'], ['Меню персонажа', '.sm-menu'], ['Отдых и рассвет', '[role="menu"]']]) {
    const cell = grid.getByRole('button', { name, exact: true })
    const box = await cell.boundingBox()
    await cell.click({ position: { x: box.width / 2, y: box.height - 4 } })
    await expect(page.locator(selector)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator(selector)).not.toBeVisible()
  }
  expect(await page.evaluate(() => window.rolls)).toEqual([])
  expect(await page.evaluate(() => window.writes)).toEqual([])
})

for (const readonly of [false, true]) test(`initiative and proficiency menu preserve actions and permissions (${readonly ? 'readonly' : 'owner'})`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/tests/tutorials/fixtures/utility-cells.html' + (readonly ? '?readonly' : ''))
  const grid = page.locator('.layout-table')
  for (const [index, name] of ['Инициатива', 'Бонус умения'].entries()) {
    const cell = grid.getByRole('button', { name, exact: true })
    await cell.focus()
    await page.keyboard.press(index ? 'Space' : 'Enter')
    const menu = page.getByRole('menu', { name, exact: true })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Изменить', exact: true })).toHaveCount(readonly ? 0 : 1)
    expect(await page.evaluate(() => window.rolls.length)).toBe(index)
    if (!readonly) {
      await menu.getByRole('menuitem', { name: 'Изменить', exact: true }).click()
      await expect(page.locator('.mes-editor')).toBeVisible()
      await expect(menu).not.toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.mes-editor')).not.toBeVisible()
      await cell.click()
      await expect(menu).toBeVisible()
    }
    await menu.getByRole('menuitem', { name: 'Бросить кубик', exact: true }).click()
    await expect(menu).not.toBeVisible()
    expect(await page.evaluate(() => window.rolls.length)).toBe(index + 1)
  }
  if (readonly) for (const name of ['КД', 'Скорость', 'Отдых и рассвет']) await expect(grid.getByRole('button', { name, exact: true })).toBeDisabled()
  expect(await page.evaluate(() => window.writes)).toEqual([])
})
