import { test, expect } from '@playwright/test'
import { checkWeaponPropertySwipe } from './fixtures/weapon-property-swipe.js'

test.use({ hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

for (const width of [475, 704]) {
  test(`a weapon property supports description, scrolling and tab swipes at ${width}px`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 932 })
    await checkWeaponPropertySwipe(page, () => page.goto('/char/test?tab=weapons'))
    expect(errors).toEqual([])
  })
}
