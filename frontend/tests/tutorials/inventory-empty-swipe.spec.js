import { test } from '@playwright/test'
import { checkInventoryEmptySwipe } from './fixtures/inventory-empty-swipe.js'

test.use({ hasTouch: true })
for (const width of [475, 704]) test(`empty inventory cells allow sheet swipes and retain tap actions at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 751 })
  await checkInventoryEmptySwipe(page, width)
})
