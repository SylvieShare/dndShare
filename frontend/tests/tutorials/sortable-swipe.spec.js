import { test } from '@playwright/test'
import { checkSortableSwipe } from './fixtures/sortable-swipe.js'

test.use({ hasTouch: true })
for (const width of [475, 704]) test(`sorting owns the gesture before sheet navigation at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 932 })
  await checkSortableSwipe(page, width)
})
