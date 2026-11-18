import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function setup(page, version, owner = true) {
  const api = await fixture(page, 'DND5', owner)
  await page.route('**/api/char/test', route => route.fulfill({ json: {
    templateName: 'DND5', userId: owner ? 1 : 2, sourceVersionId: 1,
    sourceVersion: version, version: 1, data: api.document(), publicVisible: true,
  } }))
  await page.goto('/tests/tutorials/fixtures/tutorials.html?fullApp=1&page=/char/test?tab=basic-actions')
  await page.evaluate(async () => { await import('/src/app/fonts.css'); await document.fonts.ready })
  await expect(page.getByRole('region', { name: 'Памятка по действиям' })).toBeVisible()
  return api
}

for (const width of [390, 834, 1920]) for (const version of ['2014', '2024']) {
  test(`basic actions ${version} at ${width}`, async ({ page }, testInfo) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    const api = await setup(page, version)
    const guide = page.getByRole('region', { name: 'Памятка по действиям' })
    await expect(guide).toContainText(`D&D ${version}`)
    await expect(guide.locator('.basic-actions-grid button')).toHaveCount(version === '2024' ? 12 : 10)
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Действия', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await guide.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`actions-${version}-${width}.png`), fullPage: true })
    await guide.getByRole('button', { name: 'Засада', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Засада', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(version === '2024' ? 'Сл 15' : 'Мастер определяет')
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(dialog).toBeHidden()
    await guide.getByRole('button', { name: version === '2024' ? 'Магия' : 'Наложение заклинания', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(version === '2024' ? 'только одну ячейку' : 'только заговор')
    await page.keyboard.press('Escape')
    expect(api.writes).toEqual([])
    expect(errors).toEqual([])
  })
}

test('read-only guide works offline, with keyboard, resizing and navigation', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 834, height: 1000 })
  const api = await setup(page, '2024', false)
  await context.setOffline(true)
  const guide = page.getByRole('region', { name: 'Памятка по действиям' })
  const reaction = guide.getByRole('button', { name: 'Реакция', exact: true })
  await reaction.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Реакция' })).toContainText('в начале твоего следующего хода')
  await page.keyboard.press('Escape')
  for (const width of [390, 1920, 834]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(guide).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Действия', exact: true })).toHaveAttribute('aria-current', 'page')
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Оружие', exact: true }).click()
  await expect(guide).toBeHidden()
  await page.evaluate(() => window.characterHistoryBack())
  await expect(guide).toBeVisible()
  expect(api.writes).toEqual([])
})
