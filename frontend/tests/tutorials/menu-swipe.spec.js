import { test, expect } from '@playwright/test'
import { checkMenuSwipe } from './fixtures/menu-swipe.js'
test.use({ hasTouch: true })
for (const width of [475, 704]) test(`menus block the dismissal swipe and allow the following swipe at ${width}`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  await checkMenuSwipe(page, width)
  expect(errors).toEqual([])
})
