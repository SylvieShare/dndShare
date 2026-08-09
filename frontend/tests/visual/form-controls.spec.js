import { expect, test } from '@playwright/test'

test('form controls keep readable contrast in a morph window', async ({ page }) => {
  await page.goto('/tests/visual/fixtures/form-controls.html')
  const controls = page.getByTestId('form-controls')
  await expect(controls).toBeVisible()
  await expect(controls).toHaveScreenshot('form-controls.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})
