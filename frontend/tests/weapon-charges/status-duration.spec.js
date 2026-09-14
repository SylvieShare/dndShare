import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('http://127.0.0.1:5176/api/**', route => route.fulfill({ json: { items: [] } }))
})

async function editDuration(page, mobile) {
  if (mobile) {
    if (!await page.getByRole('dialog', { name: 'Статусы', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Статусы', exact: true }).click()
      await page.getByRole('menuitem', { name: /^Статусы/ }).click()
    }
    await page.getByRole('button', { name: 'Изменить длительность: Ускорение', exact: true }).first().click()
  } else {
    await page.locator('.dsov-effect').first().click()
    await page.getByRole('menuitem', { name: 'Изменить длительность', exact: true }).click()
  }
}

for (const mobile of [false, true]) {
  test(`edits the active instance, validates and preserves other instances (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 })
    await page.goto(`/tests/weapon-charges/status-duration.html${mobile ? '?mobile' : ''}`)
    const durationLabel = page.locator(mobile ? '.dmsm-status-duration' : '.dsov-duration')
    await expect(durationLabel.first()).toHaveText(mobile ? '10 мин.' : '10 минут')
    await editDuration(page, mobile)
    await page.getByRole('spinbutton', { name: 'Количество' }).fill('3')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Длительность: Ускорение', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => window.fixture.updates)).toEqual([])
    await editDuration(page, mobile)
    await page.getByRole('combobox', { name: 'Когда заканчивается' }).selectOption('rounds')
    await page.getByRole('spinbutton', { name: 'Количество' }).fill('0')
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
    await page.getByRole('spinbutton', { name: 'Количество' }).fill('3')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(durationLabel.first()).toHaveText(mobile ? '3 р.' : '3 раунда')
    const state = await page.evaluate(() => ({ states: window.fixture.values.states, effect: window.fixture.effect }))
    expect(state.states[0]).toMatchObject({ duration: { kind: 'rounds', value: 3 }, params: { bonus: 2 }, source: { item_id: 100 } })
    expect(state.states[1].duration).toEqual({ kind: 'hours', value: 1 })
    expect(state.effect.data.duration).toEqual({ kind: 'minutes', value: 10 })
    await expect(page.getByRole('dialog', { name: 'Длительность: Ускорение', exact: true })).toHaveCount(0)
    await editDuration(page, mobile)
    await page.getByRole('combobox', { name: 'Когда заканчивается' }).selectOption('custom')
    await expect(page.getByRole('spinbutton', { name: 'Количество' })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Условие окончания' }).fill('До конца следующего хода')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(durationLabel.first()).toHaveText('До конца следующего хода')
  })
}

test('readers see durations and cannot edit or use potions', async ({ page }) => {
  await page.goto('/tests/weapon-charges/status-duration.html?reader')
  await expect(page.locator('.dsov-duration').first()).toHaveText('10 минут')
  await page.locator('.dsov-effect').first().click()
  await expect(page.getByRole('menuitem', { name: 'Изменить длительность', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Действия: Зелье скорости' }).click()
  await expect(page.getByRole('menuitem', { name: 'Использовать на себя', exact: true })).toHaveCount(0)
})

test('self use is a separate action and a removed effect is not restored by its editor', async ({ page }) => {
  await page.goto('/tests/weapon-charges/status-duration.html')
  await page.getByRole('button', { name: 'Действия: Зелье скорости' }).click()
  await expect(page.getByRole('menuitem', { name: 'Использовать на себя', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await editDuration(page, false)
  await page.evaluate(() => window.fixture.values.states.splice(0, 1))
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => window.fixture.values.states)).toHaveLength(1)
})
