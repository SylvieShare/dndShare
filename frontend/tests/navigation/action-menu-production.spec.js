import { expect, test } from '@playwright/test'
import { installCharacterChromeFixture } from './characterChromeFixture.js'

test.use({ hasTouch: true, reducedMotion: 'no-preference' })

async function watchMenuEntrance(page) {
  await page.evaluate(() => {
    window.menuEntered = false
    document.addEventListener('transitionrun', event => {
      if (event.propertyName === 'opacity' && event.target.matches('.base-popover')) {
        window.menuEntered = true
      }
    })
  })
}

for (const width of [390, 834, 1920]) {
  test(`production action menus animate after a tap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installCharacterChromeFixture(page)
    await page.goto('/chars')
    await watchMenuEntrance(page)
    const card = page.locator('.char-card').first()
    const listTrigger = card.locator('.menu-btn')
    await listTrigger.tap()
    const listMenu = page.locator('.base-popover').filter({ hasText: 'Клонировать' })
    await expect.poll(() => page.evaluate(() => window.menuEntered)).toBe(true)
    await expect(listTrigger).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
    await expect(listMenu.getByText('Клонировать', { exact: true })).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
    await page.keyboard.press('Escape')
    await expect(listMenu).toHaveCount(0)

    await page.goto('/char/chrome-0', { waitUntil: 'networkidle' })
    if (width < 1200) {
      const tabs = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа' })
      await tabs.getByRole('button', { name: 'Статы', exact: true }).click()
    }
    await watchMenuEntrance(page)
    const save = page.getByRole('button', { name: / — спасбросок$/ }).filter({ visible: true }).first()
    await expect(save).toBeVisible()
    await save.tap()
    const rollMenu = page.getByRole('menu', { name: / — спасбросок$/ })
    await expect.poll(() => page.evaluate(() => window.menuEntered)).toBe(true)
    await expect(rollMenu.getByRole('button', { name: 'Помеха', exact: true })).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
  })
}
