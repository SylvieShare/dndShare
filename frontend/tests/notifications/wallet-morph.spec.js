import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`money keeps its source geometry through open and close (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    page.on('pageerror', error => { throw error })
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
    await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/')
      ? route.fulfill({ json: { types: [], items: [], presets: [], suggests: [] } })
      : route.continue())
    await page.goto('/tests/notifications/fixtures/inventory.html')
    const trigger = page.locator('.inventory-wallet').getByRole('button', { name: 'Изменить кошелёк', exact: true })
    await expect(trigger).toBeVisible()
    await page.evaluate(() => {
      const source = document.querySelector('.inventory-wallet .money-view')
      const value = source.querySelector('[data-money-id="3"] .ma-value')
      const a = source.getBoundingClientRect(), b = value.getBoundingClientRect()
      window.walletSourceOffset = { x: b.left - a.left, y: b.top - a.top }
      window.walletMorphFrames = []
      window.walletMorphPhase = 'open'
      let observed = false
      function sample() {
        const sheet = document.querySelector('.ms-sheet')
        const copy = sheet?.querySelector('.money-morph-copy')
        const money = copy?.querySelector('[data-money-id="3"] .ma-value')
        if (sheet && copy && money) {
          observed = true
          const panel = sheet.getBoundingClientRect(), coin = money.getBoundingClientRect()
          const original = value.getBoundingClientRect()
          const transform = new DOMMatrixReadOnly(getComputedStyle(copy).transform)
          const style = getComputedStyle(sheet)
          window.walletMorphFrames.push({
            phase: window.walletMorphPhase,
            opacity: Number(getComputedStyle(copy.querySelector('.money-content')).opacity),
            screenX: coin.left, screenY: coin.top,
            x: coin.left - panel.left - transform.m41 - Number.parseFloat(style.borderLeftWidth),
            y: coin.top - panel.top - transform.m42 - Number.parseFloat(style.borderTopWidth),
            distance: Math.hypot(coin.left - original.left, coin.top - original.top),
          })
        } else if (observed) { window.walletMorphFinished = true; return }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await trigger.click()
    await expect(page.locator('.mes-editor')).toBeVisible()
    await expect.poll(() => page.locator('.ms-sheet').evaluate(el => el.style.position)).toBe('')
    await page.evaluate(() => { window.walletMorphPhase = 'settled' })
    // A third digit changes the source width while its visual stand-in is open.
    const editor = page.locator('.mes-editor')
    await editor.getByRole('button', { name: '9', exact: true }).click()
    await editor.getByRole('button', { name: '0', exact: true }).click()
    await editor.getByRole('button', { name: 'Взять', exact: true }).click()
    expect(await page.evaluate(() => window.readWallet().amounts[1])).toBe(100)
    await page.evaluate(() => { window.walletMorphPhase = 'close' })
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => window.walletMorphFinished)).toBe(true)
    const result = await page.evaluate(() => ({ offset: window.walletSourceOffset, frames: window.walletMorphFrames }))
    expect(result.frames.every(frame => frame.opacity === 1)).toBe(true)
    for (const phase of ['open', 'close']) {
      const frames = result.frames.filter(frame => frame.phase === phase)
      expect(frames.length).toBeGreaterThan(3)
      expect(Math.max(...frames.map(frame => Math.hypot(frame.x - result.offset.x, frame.y - result.offset.y)))).toBeLessThan(1.5)
    }
    const opening = result.frames.filter(frame => frame.phase === 'open')
    for (const coordinate of ['screenX', 'screenY']) {
      const start = opening[0][coordinate], end = opening.at(-1)[coordinate]
      const minimum = Math.min(start, end) - 3, maximum = Math.max(start, end) + 3
      expect(opening.every(frame => frame[coordinate] >= minimum && frame[coordinate] <= maximum)).toBe(true)
    }
    expect(result.frames.filter(frame => frame.phase === 'close').at(-1).distance).toBeLessThan(3)
    await expect(trigger).toBeVisible()
    expect(await page.evaluate(() => window.walletWrites.length)).toBe(1)
  })
}
