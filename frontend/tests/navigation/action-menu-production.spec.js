import { expect, test } from '@playwright/test'
import { installCharacterChromeFixture } from './characterChromeFixture.js'

test.use({ hasTouch: true, reducedMotion: 'no-preference' })

test('production phone tabbar crossfades captions while the finger is held', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await installCharacterChromeFixture(page)
  await page.goto('/char/chrome-0', { waitUntil: 'networkidle' })
  const tabs = page.getByRole('navigation', { name: 'Вкладки персонажа' })
  await expect(tabs.getByRole('button', { name: 'База', exact: true })).toHaveAttribute('aria-current', 'page')
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: 820 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 232, y: 820 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 135, y: 820 }] })
  await expect(tabs.locator('.mobile-tab-caption').first()).toHaveCSS('opacity', '0.5')
  await expect(tabs.locator('.mobile-tab-caption').nth(1)).toHaveCSS('opacity', '0.5')
  const sizes = await tabs.locator('.mobile-tab-btn').evaluateAll(buttons => buttons.slice(0, 2).map(el => el.getBoundingClientRect().width))
  expect(sizes[0]).toBeCloseTo(sizes[1], 1)
  const indicator = await tabs.locator('.mobile-tab-indicator').boundingBox()
  const first = await tabs.locator('.mobile-tab-btn').nth(0).boundingBox()
  const second = await tabs.locator('.mobile-tab-btn').nth(1).boundingBox()
  expect(indicator.width).toBeCloseTo((first.width + second.width) / 2, 1)
  expect(indicator.x).toBeCloseTo((first.x + second.x) / 2, 1)
  await testInfo.attach('held-swipe', { body: await page.screenshot(), contentType: 'image/png' })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await expect(tabs.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
})

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
