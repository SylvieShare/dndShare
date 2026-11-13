import { test } from '@playwright/test'
import { checkHeadingActions } from './fixtures/heading-actions.js'

for (const width of [475, 704, 1440]) test(`heading metrics open their own controls at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 932 })
  await checkHeadingActions(page, { width })
})
test('heading preserves reader permissions for armor, health and passive descriptions', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 932 })
  await checkHeadingActions(page, { width: 475, owner: false })
})
