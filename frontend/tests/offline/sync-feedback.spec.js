import { test } from '@playwright/test'
import { checkSyncFeedback } from './sync-feedback.js'

test('background data sync stays invisible and reports actionable incidents once', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 751 })
  await checkSyncFeedback(page)
})
