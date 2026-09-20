import { expect, test } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/') ? route.fulfill({ json: { items: [] } }) : route.continue())
})
for (const width of [1280, 390]) {
  test(`elf subraces expose only their own lore and abilities (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/species/fixture.html?elf')
    const base = page.getByRole('region', { name: 'Способности расы', exact: true })
    await expect(base.locator('.race-ability-card')).toHaveCount(3)
    await expect(base).not.toContainText('Эльфийская родословная')
    await expect(page.locator('.race-lore')).not.toContainText('Зендрик')
    await expect(page.locator('.race-lore')).not.toContainText('Сильванести')
    const picker = page.locator('.race-choices').getByRole('region', { name: 'Выбор подрасы' })
    await expect(picker.locator('.subrace-card')).toHaveCount(3)
    await picker.getByRole('button', { name: /Дроу/ }).click()
    const details = picker.locator('.subrace-details')
    await expect(details).toContainText('Зендрик')
    await expect(details).not.toContainText('Сильванести')
    await expect(details.locator('.race-ability-card p')).toHaveCount(0)
    await expect(details).toContainText('Пляшущие огоньки')
    await expect(details.locator('.race-ability-card').filter({ hasText: 'Магия: Тьма' })).toContainText('С 5-го уровня')
    await details.getByRole('button', { name: /Магия: Огонь фей/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Это заклинание всегда подготовлено')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await picker.getByRole('button', { name: /Лесной эльф/ }).click()
    await expect(details).toContainText('Тайрнадал')
    await expect(details).not.toContainText('Зендрик')
    await expect(details).not.toContainText('Пляшущие огоньки')
    await expect(details).toContainText('Бесследное передвижение')
    await expect(page.locator('.race-card-fact').filter({ hasText: 'Скорость' })).toContainText('35 фт')
    await picker.getByRole('button', { name: /Высший эльф/ }).click()
    await expect(details).toContainText('Сильванести')
    await expect(details).not.toContainText('Тайрнадал')
    await details.getByRole('button', { name: /Магия: Фокусы/ }).click()
    await expect(page.getByRole('dialog')).toContainText('заменить его другим заговором')
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(page.locator('.race-card-fact').filter({ hasText: 'Скорость' })).toContainText('30 фт')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.evaluate(() => window.state.raceVariant)).toBeNull()
  })
}

for (const width of [1280, 390]) {
  test(`gnome 2014 does not duplicate its card description (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/species/fixture.html?gnome2014')
    const picker = page.getByRole('region', { name: 'Выбор подрасы' })
    for (const name of ['Скальный гном', 'Лесной гном']) {
      await picker.getByRole('button', { name: new RegExp(name) }).click()
      await expect(picker.locator('.subrace-details p')).toHaveCount(0)
      await expect(picker.locator('.subrace-card').filter({ hasText: name }).locator('.subrace-card-description')).not.toBeEmpty()
    }
  })
  test(`goliath ancestry grants only its own ability (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/species/fixture.html?goliath')
    const picker = page.getByRole('region', { name: 'Выбор подрасы' })
    await expect(picker.locator('.subrace-card')).toHaveCount(6)
    for (const [origin, ability] of [['Облачный голиаф', 'Прогулка на облаках'], ['Каменный голиаф', 'Крепость камня'], ['Штормовой голиаф', 'Грохот бури']]) {
      await picker.getByRole('button', { name: new RegExp(origin) }).click()
      await expect(picker.locator('.race-ability-card')).toHaveCount(1)
      await expect(picker.locator('.race-ability-card')).toContainText(ability)
      await expect(picker.locator('.race-ability-card p')).toHaveCount(0)
      await picker.getByRole('button', { name: new RegExp(ability) }).click()
      await expect(page.getByRole('dialog')).toContainText('Бонусу владения')
      await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
