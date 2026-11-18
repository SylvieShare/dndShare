import { expect, test } from '@playwright/test'

test('all combat renderers share the 50 percent floor and expand after resizing', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tests/tutorials/fixtures/raw-formula-fit.html')
  await page.evaluate(() => document.fonts.ready)
  for (const name of ['metric', 'weapon', 'dice', 'preview', 'attack', 'save']) {
    const sample = page.locator(`[data-formula-case=${name}]`)
    const fit = sample.locator('[data-fit-owner]')
    await expect(fit).toHaveCount(1)
    await expect(fit).toHaveAttribute('data-fit-scale', '0.5')
    await expect(fit).toHaveAttribute('data-fit-wrapping', 'true')
    expect(await sample.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await fit.evaluate(el => el.firstElementChild.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1)).toBe(true)
  }
  await page.evaluate(() => { window.formulaState.width = 900; window.formulaState.count = 1 })
  for (const fit of await page.locator('[data-fit-owner]').all()) {
    await expect(fit).toHaveAttribute('data-fit-scale', '1')
    await expect(fit).toHaveAttribute('data-fit-wrapping', 'false')
  }
  expect(errors).toEqual([])
})
