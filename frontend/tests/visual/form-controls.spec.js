import { expect, test } from '@playwright/test'

test('form controls keep readable contrast in a morph window', async ({ page }) => {
  await page.goto('/tests/visual/fixtures/form-controls.html')
  const controls = page.getByTestId('form-controls')
  await expect(controls).toBeVisible()
  const cardWidth = (await controls.boundingBox()).width
  expect((await controls.locator('.fn-wrap').boundingBox()).width).toBeLessThan(cardWidth)
  expect((await controls.locator('.mt-toggle').boundingBox()).width).toBeLessThan(cardWidth)
  await expect(controls).toHaveScreenshot('form-controls.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})
