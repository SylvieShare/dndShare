import { expect, test } from '@playwright/test'

async function openActions(row) {
  const title = row.locator('.sp-name')
  await title.scrollIntoViewIfNeeded()
  await row.page().evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await title.click()
  await expect(row.page().getByRole('menu')).toBeVisible()
}

for (const width of [320, 390, 834, 1440]) test(`formulas shrink before wrapping and preparation uses a label at ${width}px`, async ({ page }, info) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1100 })
  await page.goto('/tests/tutorials/fixtures/spell-rolls.html?fitting')
  const chaos = page.locator('.spell-row').filter({ hasText: 'Снаряд хаоса' })
  const long = page.locator('.spell-row').filter({ hasText: 'Длинная формула' })
  await expect(chaos).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const damage = chaos.getByRole('button', { name: 'Настроить бросок урона', exact: true })
  const fit = damage.locator('[data-fit-owner]')
  await expect(fit).toHaveAttribute('data-fit-ready', '')
  await expect(fit).toHaveCount(1)
  const scale = Number(await fit.getAttribute('data-fit-scale'))
  expect(scale).toBeGreaterThanOrEqual(.5)
  expect(scale).toBeLessThanOrEqual(1)
  if (width >= 834) {
    await expect(fit).toHaveAttribute('data-fit-wrapping', 'false')
    const base = await damage.locator('.weapon-damage').boundingBox(), bonus = await damage.locator('.spell-scaling').boundingBox()
    expect(Math.abs(base.y - bonus.y)).toBeLessThan(2)
    expect(bonus.x).toBeGreaterThanOrEqual(base.x + base.width - 1)
  }
  const floor = long.locator('[data-fit-owner]')
  await expect(floor).toHaveAttribute('data-fit-wrapping', 'true')
  expect(Number(await floor.getAttribute('data-fit-scale'))).toBe(.5)
  for (const owner of await page.locator('[data-fit-owner]').all()) {
    const value = Number(await owner.getAttribute('data-fit-scale'))
    expect(value).toBeGreaterThanOrEqual(.5)
    expect(value).toBeLessThanOrEqual(1)
  }
  await expect(chaos.locator('.sp-prepared')).toHaveText('[Подготовлено]')
  await expect(page.locator('.prepared-spell-brackets')).toHaveCount(0)
  await openActions(chaos)
  await page.getByRole('menuitem', { name: 'Снять подготовку', exact: true }).click()
  await expect(chaos.locator('.sp-prepared')).toHaveCount(0)
  expect(await page.evaluate(() => window.sheetValues.spells.tabs[0].spells.find(spell => spell.id === 41).prepared)).toBe(false)
  await openActions(chaos)
  await page.getByRole('menuitem', { name: 'Подготовить', exact: true }).click()
  await expect(chaos.locator('.sp-prepared')).toBeVisible()
  await damage.click()
  await expect(page.getByRole('dialog', { name: 'Снаряд хаоса · Урон', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Бросить на урон', exact: true }).click()
  expect(await page.evaluate(() => window.rolls.at(-1).expression)).toBe('2d8+1d6')
  await chaos.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('formula-fit.png') })
  expect(errors).toEqual([])
})
