import { test, expect } from '@playwright/test'

const statSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L4 13h6l-1 9 11-13h-7z"/></svg>'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/svg/*', route => route.fulfill({ contentType: 'image/svg+xml', body: statSvg }))
})

for (const width of [390, 834, 1920]) {
  test.describe(`stat roll menu at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      page.on('pageerror', error => { throw error })
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
    })

    test('checks, saves and skills require confirmation and preserve bonuses and roll effects', async ({ page }) => {
      const cases = [
        { label: 'Ловкость — проверка', title: 'Ловкость — проверка', bonus: 3, advantage: false, disadvantage: true, mode: 'disadvantage', scope: 'ability_check' },
        { label: 'Ловкость — спасбросок', title: 'Ловкость — спасбросок', bonus: 6, advantage: true, disadvantage: false, mode: 'advantage', scope: 'saving_throw' },
        { label: 'Скрытность — проверка', title: 'Скрытность', bonus: 7, advantage: false, disadvantage: false, mode: 'normal', scope: 'ability_check' },
      ]
      for (const [index, entry] of cases.entries()) {
        await page.getByRole('button', { name: entry.label, exact: true }).click()
        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible()
        const edit = menu.getByRole('menuitem', { name: 'Изменить' })
        expect(await edit.evaluate(el => el.nextElementSibling?.getAttribute('role'))).toBe('separator')
        expect((await edit.boundingBox()).y).toBeLessThan((await menu.getByText('Режим броска', { exact: true }).boundingBox()).y)
        expect(await page.evaluate(() => window.rolls.length)).toBe(index)
        const advantage = menu.getByRole('button', { name: 'Преимущество', exact: true })
        const disadvantage = menu.getByRole('button', { name: 'Помеха', exact: true })
        await expect(advantage).toHaveAttribute('aria-pressed', String(entry.advantage))
        await expect(disadvantage).toHaveAttribute('aria-pressed', String(entry.disadvantage))
        await expect(menu).toHaveCSS('transform', 'none')
        const a = await advantage.boundingBox(), d = await disadvantage.boundingBox()
        expect(Math.abs(a.y - d.y)).toBeLessThan(2)
        await expect(menu.getByText('Режим броска', { exact: true })).toBeVisible()
        await expect(menu.getByText(/Меньший из|Больший из/)).toHaveCount(0)
        const summary = await menu.locator('.stat-roll-summary').boundingBox()
        expect(a.y - (summary.y + summary.height)).toBeGreaterThanOrEqual(12)
        for (const button of [advantage, disadvantage]) {
          const box = await button.boundingBox()
          const arrow = await button.locator('.share-choice-card__icon').boundingBox()
          const label = await button.locator('.share-choice-card__label').boundingBox()
          expect(box.height).toBeGreaterThanOrEqual(88)
          expect(box.height).toBeLessThanOrEqual(90)
          await expect(button.locator('.share-choice-card__check')).toHaveCount(0)
          expect(arrow.y + arrow.height).toBeLessThanOrEqual(label.y)
          await expect(button.locator('.roll-badge--large .system-die--d20')).toHaveCount(2)
          expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        }
        const bounds = await menu.boundingBox()
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
        await expect(menu).toHaveCount(0)
        const roll = await page.evaluate(() => window.rolls.at(-1))
        expect(roll).toMatchObject({ title: entry.title, bonus: entry.bonus, mode: entry.mode,
          options: { color: 'var(--accent)', crit_mode: true, roll_triggers: [{ scope: entry.scope }] } })
        expect(roll.options.roll_adjustments).toEqual([entry.title === 'Скрытность'
          ? { scope: entry.scope, proficiencyRank: 2 } : { scope: entry.scope }])
      }
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })

    test('mode groups keep numeric values fixed and highlight only the chosen control', async ({ page }, testInfo) => {
      const cases = [
        ['.skill-chip', '.skill-chip-val', 'skillEffects'],
        ['.save-chip', '.save-chip-val', 'saveEffects'],
        ['.stat-body', '.stat-mod', 'checkEffects'],
      ]
      for (const [controlSelector, numberSelector, effects] of cases) {
        const control = page.locator(controlSelector), number = control.locator(numberSelector)
        await page.evaluate(key => { window.statState[key] = [] }, effects)
        await expect(control.locator('.roll-badge')).toHaveCount(0)
        const original = await number.boundingBox()
        const expectedHeight = effects === 'checkEffects' ? (width < 640 ? 44 : 26) : (width < 640 ? 32 : 28)
        const group = control.locator('.stat-roll-value')
        const originalGroup = await group.boundingBox()
        expect(originalGroup.height).toBeGreaterThanOrEqual(expectedHeight)
        expect(originalGroup.height).toBeLessThanOrEqual(expectedHeight + 1)
        for (const mode of ['advantage', 'disadvantage']) {
          await page.evaluate(({ key, mode }) => { window.statState[key] = [{ mode }] }, { key: effects, mode })
          await expect(control.locator('.stat-roll-value--mode')).toBeVisible()
          await expect(control.locator('[data-stat-roll-number]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
          const current = await number.boundingBox()
          for (const dimension of ['x', 'y', 'width', 'height']) expect(Math.abs(current[dimension] - original[dimension])).toBeLessThan(1)
          const badge = await control.locator('.roll-badge').boundingBox()
          expect((await group.boundingBox()).height).toBe(originalGroup.height)
          expect(badge.height).toBeLessThanOrEqual(expectedHeight)
          expect(await group.evaluate(el => getComputedStyle(el, '::before').inset)).toBe('0px')
          if (effects === 'checkEffects') expect(badge.x).toBeGreaterThan(current.x + current.width)
          else expect(badge.x + badge.width).toBeLessThan(current.x)
        }
        const tile = page.locator('.stat-block')
        const background = await tile.evaluate(el => getComputedStyle(el).backgroundColor)
        await control.click()
        await expect(page.getByRole('menu')).toBeVisible()
        await expect(page.locator('.stat-roll-value--active')).toHaveCount(1)
        await expect(control.locator('.stat-roll-value')).toHaveClass(/stat-roll-value--active/)
        await expect(tile).not.toHaveClass(/action-menu-source--open/)
        expect(await tile.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(background)
        await expect(control.locator('[data-stat-roll-number]')).not.toHaveCSS('box-shadow', 'none')
        await expect(control.locator('[data-stat-roll-number]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await page.keyboard.press('Escape')
        await expect(page.locator('.stat-roll-value--active')).toHaveCount(0)
        await expect(control).toBeFocused()
        await expect(control).toHaveCSS('outline-style', 'none')
        await expect(control.locator('[data-stat-roll-number]')).not.toHaveCSS('box-shadow', 'none')
      }
      await page.locator('.stat-block').screenshot({ path: testInfo.outputPath('grouped-roll-values.png') })
    })

    test('blessing is enabled for saves and can be omitted for one roll', async ({ page }, testInfo) => {
      const trigger = page.getByRole('button', { name: 'Ловкость — спасбросок', exact: true })
      await trigger.click()
      const blessing = page.getByRole('switch', { name: 'Благословение', exact: true })
      await expect(blessing).toHaveAttribute('aria-checked', 'true')
      expect(await blessing.evaluate(node => node.previousElementSibling?.getAttribute('role'))).not.toBe('separator')
      await expect.poll(() => blessing.locator('.item-icon .svg-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
      await blessing.locator('.roll-bonus-option__name').click()
      await expect(blessing).toHaveAttribute('aria-checked', 'false')
      await page.mouse.move(0, 0)
      const contrast = await blessing.locator('.share-toggle-switch__track').evaluate(track => {
        let parent = track.parentElement
        while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement
        return { track: getComputedStyle(track).backgroundColor, background: parent && getComputedStyle(parent).backgroundColor }
      })
      expect(contrast.track).not.toBe(contrast.background)
      await page.getByRole('menu').screenshot({ path: testInfo.outputPath('roll-menu.png'), animations: 'disabled' })
      await blessing.locator('.item-icon').click()
      await expect(blessing).toHaveAttribute('aria-checked', 'true')
      await blessing.locator('.roll-bonus-option__formula').click()
      await expect(blessing).toHaveAttribute('aria-checked', 'false')
      await blessing.press('Space')
      await expect(blessing).toHaveAttribute('aria-checked', 'true')
      await blessing.press('Space')
      await expect(blessing).toHaveAttribute('aria-checked', 'false')
      await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).options.bonus_formula)).toBe('')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await trigger.click()
      await expect(page.getByRole('switch', { name: 'Благословение' })).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).options.bonus_formula)).toBe('1d4')
    })

    test('temporary overrides reset on reopen and use fresh sheet defaults', async ({ page }) => {
      const trigger = page.getByRole('button', { name: 'Ловкость — проверка', exact: true })
      const menu = page.getByRole('menu')
      await trigger.focus()
      await page.keyboard.press('Enter')
      const advantage = menu.getByRole('button', { name: 'Преимущество', exact: true })
      const disadvantage = menu.getByRole('button', { name: 'Помеха', exact: true })
      await disadvantage.click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.at(-1).mode)).toBe('normal')
      await trigger.click()
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'true')
      await advantage.press('Space')
      await expect(advantage).toHaveAttribute('aria-pressed', 'true')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await disadvantage.click()
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'true')
      await expect(advantage).toHaveAttribute('aria-pressed', 'false')
      await expect(disadvantage).toHaveCSS('box-shadow', /inset/)
      await expect(advantage).toHaveCSS('box-shadow', 'none')
      const selectedBox = await disadvantage.boundingBox()
      await advantage.click()
      await expect(advantage).toHaveCSS('box-shadow', /inset/)
      await expect(disadvantage).toHaveCSS('box-shadow', 'none')
      expect(await disadvantage.boundingBox()).toEqual(selectedBox)
      await disadvantage.click()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.checkEffects = [{ mode: 'advantage' }] })
      await trigger.click()
      await expect(advantage).toHaveAttribute('aria-pressed', 'true')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await page.mouse.click(5, 5)
      await expect(menu).toHaveCount(0)
      await page.evaluate(() => { window.statState.value.check_roll_mode = 'normal' })
      await trigger.click()
      await expect(advantage).toHaveAttribute('aria-pressed', 'true')
      await expect(disadvantage).toHaveAttribute('aria-pressed', 'false')
      await advantage.click()
      await menu.getByRole('menuitem', { name: 'Бросить', exact: true }).click()
      expect(await page.evaluate(() => window.rolls.map(roll => roll.mode))).toEqual(['normal', 'normal'])
      expect(await page.evaluate(() => window.writes)).toEqual([])
    })
  })
}

test('editing a skill keeps its original name and changes only that skill', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  await page.getByRole('button', { name: 'Скрытность — проверка', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Изменить' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Скрытность', exact: true })).toBeVisible()
  await dialog.getByPlaceholder('Скрытность').fill('Тихий шаг')
  await expect(dialog.getByRole('heading', { name: 'Тихий шаг (Скрытность)' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Без владения', exact: true }).click()
  await dialog.getByRole('button', { name: 'Добавить бонус' }).click()
  await expect(dialog.getByText('Режим броска')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.statState.value.skills[4])).toMatchObject({
    up: 0, override_title: 'Тихий шаг', bonuses: [{ value: 0 }],
  })
  await dialog.getByRole('spinbutton').fill('-2')
  await expect(dialog.locator('.stat-editor-heading .stat-editor-total')).toContainText('+1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Тихий шаг — проверка' })).toBeVisible()
})

for (const width of [390, 834, 1440]) test(`roll badges show the discarded d20 and readable stat icons at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  const advantage = page.locator('.save-chip .roll-badge'), disadvantage = page.locator('.stat-body .roll-badge')
  await expect(advantage).toHaveAttribute('aria-label', /Преимущество.*Эффект спасброска/)
  await expect(disadvantage).toHaveAttribute('aria-label', /Помеха.*Эффект проверки/)
  await expect(advantage.locator('.roll-badge__caption')).toHaveText('Преимущество')
  await expect(disadvantage.locator('.roll-badge__caption')).toHaveText('Помеха')
  for (const [badge, discarded] of [[advantage, '1'], [disadvantage, '20']]) {
    await expect(badge.locator('.system-die--d20')).toHaveCount(2)
    await expect(badge.locator('.system-die__value')).toHaveText(['1', '20'])
    await expect(badge.locator('.roll-badge__strike')).toHaveCount(1)
    await expect(badge.locator('.roll-badge__die--discarded')).toHaveAttribute('data-roll-value', discarded)
    expect(await badge.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  }
  const colors = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.append(probe)
    const result = ['--success', '--danger'].map(name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color })
    probe.remove(); return result
  })
  await expect(advantage).toHaveCSS('color', colors[0])
  await expect(disadvantage).toHaveCSS('color', colors[1])
  await expect(page.locator('.skill-item .roll-badge--cancelled')).toHaveText('ОБЫЧ.')
  await expect.poll(() => page.locator('.stat-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  expect(await page.locator('.stat-icon').evaluate(node => getComputedStyle(node).color)).toBe(await page.locator('.stat-mod').evaluate(node => getComputedStyle(node).color))
  expect((await page.locator('.stat-icon').boundingBox()).width).toBeGreaterThan(20)
  await page.locator('.stat-block').screenshot({ path: testInfo.outputPath('stat-roll-badges.png') })
  await page.evaluate(() => { window.statState.checkEffects = []; window.statState.value.check_roll_mode = 'normal' })
  await expect(page.locator('.stat-body .roll-badge')).toHaveCount(0)
})

test('a stripped SVG reference is restored from the local cache after an offline reload', async ({ page }) => {
  let requests = 0
  await page.route('**/api/svg/901', route => { requests++; return route.fulfill({ contentType: 'image/svg+xml', body: statSvg.replace('viewBox=', 'onload="window.svgAssetExecuted=true" viewBox=') }) })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  await expect.poll(() => page.locator('.stat-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  expect(requests).toBe(1)
  expect(await page.evaluate(() => window.svgAssetExecuted)).toBeUndefined()
  await page.route('**/api/svg/901', route => { requests++; return route.abort() })
  await page.reload()
  await expect.poll(() => page.locator('.stat-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  expect(requests).toBe(1)
  expect(await page.evaluate(() => window.svgAssetExecuted)).toBeUndefined()
})


test('save and ability totals follow their own bonus rows before closing', async ({ page }) => {
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  await page.getByRole('button', { name: 'Ловкость — спасбросок', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Изменить' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.stat-editor-heading .stat-editor-total')).toContainText('+6')
  await dialog.getByRole('spinbutton').fill('3')
  await expect(dialog.locator('.stat-editor-heading .stat-editor-total')).toContainText('+8')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Редактировать: Ловкость', exact: true }).click()
  await expect(dialog.locator('.stat-editor-heading .stat-editor-total')).toContainText('16')
  await dialog.getByRole('button', { name: 'Добавить бонус' }).click()
  await dialog.locator('.bl-row input[type=number]').fill('2')
  await expect(dialog.locator('.stat-editor-heading .stat-editor-total')).toContainText('18')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.statState.value.save_bonuses[0].value)).toBe(3)
})

test('inline dictionary artwork is cached before metadata switches to an ID-only icon', async ({ page }) => {
  let requests = 0
  await page.route('**/api/svg/901', route => { requests++; return route.abort() })
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html?inlineSvg')
  await expect(page.locator('.stat-icon svg')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const { openLocalDatabase } = await import('/src/platform/storage.js')
    return await (await openLocalDatabase()).get('public:svg:901') || ''
  })).toContain('<svg')
  await page.goto('/tests/tutorials/fixtures/stat-rolls.html')
  await expect.poll(() => page.locator('.stat-icon').evaluate(node => node.style.maskImage)).toContain('blob:')
  expect(requests).toBe(0)
})
