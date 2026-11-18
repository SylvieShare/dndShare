import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

for (const width of [390, 475, 834, 1920]) test(`bundled action guide at ${width}`, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  await page.goto('/char/test?tab=basic-actions')
  const guide = page.getByRole('region', { name: 'Памятка по действиям' })
  await expect(guide).toBeVisible()
  const lastTab = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа' }).getByRole('button').last()
  await expect(lastTab).toHaveAccessibleName('Памятка')
  await expect(lastTab).toHaveAttribute('aria-current', 'page')
  const buttons = guide.locator('.basic-actions-grid button')
  await expect(buttons).toHaveCount(10)
  await expect.poll(() => buttons.evaluateAll(nodes => nodes.every(button => {
    const bounds = button.getBoundingClientRect()
    const icon = button.querySelector('.basic-action-icon').getBoundingClientRect()
    const chevron = button.querySelector('.basic-action-chevron').getBoundingClientRect()
    const style = getComputedStyle(button)
    const start = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)
    const end = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)
    return Math.abs(icon.left - bounds.left - start) < 1 && Math.abs(bounds.right - chevron.right - end) < 1
  }))).toBe(true)
  expect(await guide.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath(`actions-${width}.png`), fullPage: true })
  await guide.getByRole('button', { name: 'Подготовка', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Подготовка', exact: true })
  await expect(dialog).toContainText('потрать реакцию')
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(api.writes).toEqual([])
  expect(errors).toEqual([])
})
