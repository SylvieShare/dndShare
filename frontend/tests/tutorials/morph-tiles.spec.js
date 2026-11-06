import { test, expect } from '@playwright/test'
for (const mobile of [false, true]) test(`shared morph heading and independent aside on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  const save = page.getByRole('button', { name: 'Ловкость — спасбросок', exact: true })
  const skill = page.getByRole('button', { name: 'Скрытность — проверка', exact: true })
  await expect(save).toHaveAccessibleDescription('Владение')
  await expect(skill).toHaveAccessibleDescription('Мастерство')
  await expect(save.locator('.proficiency-dot')).toHaveCount(1)
  await expect(page.locator('.skill-label .proficiency-dot')).toHaveCount(2)
  await expect(page.locator('.stat-view .skill-line')).toHaveCount(0)
  await expect(page.locator('.stat-view > .tile-accent-strip')).toBeVisible()
  await expect(page.locator('.stat-view .morph-tile-pencil')).toHaveCount(0)
  await expect(page.locator('.stat-body')).toHaveCSS('padding-top', '0px')
  await save.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  await page.keyboard.press('Escape')
  const heading = page.getByRole('button', { name: 'Редактировать: Ловкость', exact: true })
  await heading.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Ловкость', exact: true })
  await expect(dialog.getByText('Основное значение')).toBeVisible()
  await expect(dialog.getByText('Добавить навык')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.writes)).toEqual([])
})

test('compact utility headings and values stay within the 64px grid rows', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  const tiles = page.getByTestId('utility-grid').locator('.util-tile')
  await expect(tiles).toHaveCount(4)
  for (const tile of await tiles.all()) {
    const bounds = await tile.boundingBox()
    expect(bounds.height).toBe(64)
    await expect(tile.locator('.morph-tile-header--compact')).toHaveCount(1)
    for (const part of await tile.locator('.morph-tile-title, .morph-tile-pencil, .stf-body, .stf-val, .stf-roll').all()) {
      const inner = await part.boundingBox()
      expect(inner.y).toBeGreaterThanOrEqual(bounds.y)
      expect(inner.y + inner.height).toBeLessThanOrEqual(bounds.y + bounds.height)
      expect(inner.x + inner.width).toBeLessThanOrEqual(bounds.x + bounds.width)
    }
    expect(await tile.locator('.morph-tile-header').evaluate(el => getComputedStyle(el).marginBottom)).toBe('0px')
  }
})

test('shared faces keep their intended surface and previews avoid nested tiles', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/tests/tutorials/fixtures/tile-faces.html')
  const sources = page.locator('[data-testid$="-source"]')
  await expect(sources).toHaveCount(12)
  for (const source of await sources.all()) {
    if (await source.getAttribute('data-testid') === 'DndStatView-source') {
      await expect(source).toHaveClass(/base-tile/)
      await expect(source).not.toHaveClass(/base-tile--outlined/)
      const face = await source.evaluate(el => {
        const style = getComputedStyle(el)
        return { background: style.backgroundColor, surface: style.getPropertyValue('--surface').trim(), border: style.borderTopWidth, shadow: style.boxShadow }
      })
      expect(face.background).not.toBe('rgba(0, 0, 0, 0)')
      expect(face.border).toBe('0px')
      expect(face.shadow).toBe('none')
    } else await expect(source).toHaveClass(/base-tile/)
    await expect(source).toHaveClass(/morph-tile/)
    await expect(source.locator('.morph-tile')).toHaveCount(0)
    const preview = page.getByTestId((await source.getAttribute('data-testid')).replace('-source', '-preview'))
    await expect(preview).toHaveClass(/morph-tile/)
    await expect(preview).not.toHaveClass(/base-tile/)
    await expect(preview.locator('.morph-tile')).toHaveCount(0)
  }
})


test('floating select list has a frame while its input stays frameless', async ({ page }) => {
  await page.goto('/tests/tutorials/fixtures/tile-faces.html')
  const select = page.getByTestId('floating-select')
  await expect(select.locator('.vs-button')).toHaveCSS('border-top-width', '0px')
  await select.locator('.vs-button').click()
  await expect(select.locator('.vs-drop')).toHaveCSS('border-top-width', '1px')
  await expect(select.locator('.vs-drop')).toHaveCSS('background-color', 'rgb(52, 52, 62)')
  await select.locator('.vs-option').last().hover()
  await expect(select.locator('.vs-option').last()).toHaveCSS('background-color', 'rgb(66, 66, 79)')
  await select.locator('.vs-option').last().click()
  await expect(select.locator('.vs-drop')).toHaveCount(0)
  await expect(select.locator('.vs-button')).toContainText('Второй вариант')
})
