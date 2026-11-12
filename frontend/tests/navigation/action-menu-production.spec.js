import { expect, test } from '@playwright/test'
import { installCharacterChromeFixture } from './characterChromeFixture.js'

test.use({ hasTouch: true, reducedMotion: 'no-preference' })

test('production phone tabbar crossfades captions while the finger is held', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await installCharacterChromeFixture(page)
  await page.goto('/char/chrome-0', { waitUntil: 'networkidle' })
  const tabs = page.getByRole('navigation', { name: 'Вкладки персонажа' })
  await expect(tabs.getByRole('button', { name: 'Статы', exact: true })).toHaveAttribute('aria-current', 'page')
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: 820 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 232, y: 820 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 135, y: 820 }] })
  await expect(tabs.locator('.share-icon-navigation__label').first()).toHaveCSS('opacity', '0.5')
  await expect(tabs.locator('.share-icon-navigation__label').nth(1)).toHaveCSS('opacity', '0.5')
  const sizes = await tabs.locator('.share-icon-navigation__item').evaluateAll(buttons => buttons.slice(0, 2).map(el => el.getBoundingClientRect().width))
  expect(sizes[0]).toBeCloseTo(sizes[1], 1)
  const indicator = await tabs.locator('.share-icon-navigation__indicator').boundingBox()
  const first = await tabs.locator('.share-icon-navigation__item').nth(0).boundingBox()
  const second = await tabs.locator('.share-icon-navigation__item').nth(1).boundingBox()
  expect(indicator.width).toBeCloseTo((first.width + second.width) / 2, 1)
  expect(indicator.x).toBeCloseTo((first.x + second.x) / 2, 1)
  await testInfo.attach('held-swipe', { body: await page.screenshot(), contentType: 'image/png' })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await expect(tabs.getByRole('button', { name: 'Оружие', exact: true })).toHaveAttribute('aria-current', 'page')
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
  test(`production action menus animate after a tap at ${width}px`, async ({ page }, testInfo) => {
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
    await expect(listMenu).toHaveCSS('border-top-width', '1px')
    await expect(listMenu).toHaveCSS('background-color', 'rgb(52, 52, 62)')
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
    await expect(page.locator('.stat-block:visible').first()).toHaveCSS('border-top-width', '0px')
    await save.tap()
    const rollMenu = page.getByRole('menu', { name: / — спасбросок$/ })
    await expect.poll(() => page.evaluate(() => window.menuEntered)).toBe(true)
    await expect(rollMenu).toHaveCSS('border-top-width', '1px')
    await expect(rollMenu).toHaveCSS('background-color', 'rgb(52, 52, 62)')
    await testInfo.attach('framed-roll-menu', { body: await page.screenshot(), contentType: 'image/png' })
    await expect(rollMenu.getByRole('button', { name: 'Помеха', exact: true })).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
    await rollMenu.getByRole('menuitem', { name: 'Изменить', exact: true }).click()
    const editor = page.getByRole('dialog', { name: / — спасбросок$/ })
    await expect(editor.getByRole('switch', { name: 'Владение спасброском' })).toBeVisible()
    await expect(editor.getByText('Основное значение')).toHaveCount(0)
    await expect(editor.locator('.am-card')).toHaveCSS('border-top-width', '1px')
    await expect(editor.locator('.am-card')).toHaveCSS('background-color', 'rgb(39, 39, 46)')
    await expect(editor).toHaveCSS('backdrop-filter', 'blur(6px)')
    await testInfo.attach('editor-surface', { body: await page.screenshot(), contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)

  })
}


test('sheet session indicator follows its live connection', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1000 })
  await installCharacterChromeFixture(page)
  await page.route('**/api/char/chrome-0/sessions', route => route.fulfill({
    json: { sessions: [{ uuid: 'test-session', name: 'Проверка связи', role: 'player' }] },
  }))
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      constructor(url) {
        super()
        this.readyState = 0
        if (url.includes('test-session/live')) window.testSessionStream = this
      }
      close() { this.readyState = 2 }
    }
  })
  await page.goto('/char/chrome-0')
  const status = page.locator('.campaign-dot:visible').first()
  await expect(status).toHaveAccessibleName('Подключение к сессии')
  await page.evaluate(() => {
    window.testSessionStream.readyState = 1
    window.testSessionStream.onopen()
  })
  await expect(status).toHaveAccessibleName('Связь с сессией установлена')
  await page.evaluate(() => window.testSessionStream.onerror())
  await expect(status).toHaveAccessibleName('Нет связи с сессией')
})
