import { test, expect } from '@playwright/test'
import { checkSessionSidebarSwipe } from './fixtures/session-sidebar-swipe.js'

test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 1, viewport: { width: 704, height: 932 } })

test('session panels follow a left swipe and reopen from their rail buttons', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await checkSessionSidebarSwipe(page, path => page.goto(path))
  expect(errors).toEqual([])
})
