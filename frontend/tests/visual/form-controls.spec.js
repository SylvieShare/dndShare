import { expect, test } from '@playwright/test'

test('form controls keep readable contrast in a morph window', async ({ page }) => {
  await page.goto('/tests/visual/fixtures/form-controls.html')
  const controls = page.getByTestId('form-controls')
  await expect(controls).toBeVisible()
  const cardWidth = (await controls.boundingBox()).width
  expect((await controls.locator('.fn-wrap').boundingBox()).width).toBeLessThan(cardWidth)
  const modes = controls.getByRole('radiogroup')
  expect((await modes.boundingBox()).width).toBeLessThan(cardWidth)
  await expect(modes.getByRole('radio', { name: 'Среднее' })).toBeChecked()
  await modes.getByRole('radio', { name: 'Бросок' }).click()
  await expect(modes.getByRole('radio', { name: 'Бросок' })).toBeChecked()
  const number = controls.getByRole('spinbutton')
  await number.fill('15')
  await expect(number).toHaveValue('15')
  const visible = controls.getByRole('switch', { name: 'Показывать в листе' })
  await visible.click()
  await expect(visible).toBeChecked()
  const contrast = await controls.getByPlaceholder('Например, боевой стиль').evaluate(input => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
    const luminance = values => values.map(v => {
      v /= 255
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const style = getComputedStyle(input)
    const foreground = luminance(rgb(style.color)), background = luminance(rgb(style.backgroundColor))
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
})
