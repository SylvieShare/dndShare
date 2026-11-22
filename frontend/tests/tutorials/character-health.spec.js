import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function sheetFixture(page) {
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  return api
}

for (const width of [390, 475, 834, 1440]) test(`large HP and separate header AC fit without overlap; passives stay in the menu at ${width}`, async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: width === 475 ? 751 : 900 })
  const api = await sheetFixture(page)
  Object.assign(api.document().values.hp, { current: 18, max: { base: 23, bonuses: [] }, temp: 5 })
  await page.goto('/char/test')
  const heading = page.locator('.dnd-heading'), health = heading.locator('.heading-health')
  await expect(health).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await expect(health).toHaveAttribute('aria-label', 'Здоровье: 18 из 23, временные 5')
  await expect(health.locator('.health-readout')).toHaveText('18/23')
  await expect(health.locator('.health-temporary')).toHaveText('+5')
  await expect(health.locator('.health-beat')).toBeVisible()
  await expect(health.locator('.health-heart')).toBeVisible()
  await expect(health.locator('.health-heart')).toHaveAttribute('aria-hidden', 'true')
  await expect(heading.locator('.heading-armor')).toHaveCount(0)
  await expect(page.locator('[data-header-metric="armor"] strong')).toHaveText('11')
  await expect(health).toHaveClass(/heading-health--enlarged/)
  await expect(health).toHaveCSS('height', '36px')
  await expect(health).toHaveCSS('border-top-width', '1px')
  await expect(health.locator('.health-beat')).toHaveAttribute('aria-hidden', 'true')
  await expect(health.locator('[role="meter"]')).toHaveCount(0)
  await expect(heading.locator('canvas')).toHaveCount(0)
  const { numbers, temp, avatar, name, combat, hp } = await heading.evaluate(node => {
    const box = selector => node.querySelector(selector).getBoundingClientRect().toJSON()
    return {
      numbers: box('.health-summary'), temp: box('.health-temporary'),
      avatar: box('.portrait'), name: box('.identity'),
      combat: box('.heading-combat'), hp: box('.heading-health'),

    }
  })
  await testInfo.attach('header-composition', { body: await page.locator('.character-workspace-header').screenshot(), contentType: 'image/png' })
  expect(numbers.right <= temp.left + .5 || numbers.bottom <= temp.top + .5).toBe(true)
  expect(hp.x).toBeGreaterThan(avatar.x + avatar.width)
  expect(combat.top).toBeGreaterThanOrEqual(name.bottom - .5)
  await expect(heading.locator('.heading-metrics')).toHaveCount(0)
  await expect(health.locator('strong')).toHaveCSS('font-weight', '700')
  expect(await health.locator('strong').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Cormorant Garamond')
  const uiFamily = await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)
  expect(await health.locator('.health-readout small').evaluate(node => getComputedStyle(node).fontFamily)).toBe(uiFamily)
  expect(await health.locator('.health-temporary').evaluate(node => getComputedStyle(node).fontFamily)).toBe(uiFamily)
  await expect(health).toHaveCSS('padding-left', '10px')
  await expect(health).toHaveCSS('padding-right', '10px')
  // Transformed bounds may exceed the CSS width by a floating-point fraction.
  expect((await heading.boundingBox()).width).toBeLessThanOrEqual(420.5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  if (width === 475) {
    await health.click()
    const editor = page.getByRole('dialog', { name: 'Здоровье', exact: true })
    await expect(editor).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    expect(api.writes).toEqual([])
  }
  expect(errors).toEqual([])
})

test('large header HP values remain fully visible in a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 932 })
  const api = await sheetFixture(page)
  api.document().values.hp = { current: 9999, max: { base: 9999, bonuses: [] }, temp: 123 }
  await page.goto('/char/test', { waitUntil: 'networkidle' })
  const health = page.locator('.dnd-heading .heading-health')
  await expect(health.locator('.health-readout')).toHaveText('9999/9999')
  await expect(health.locator('.health-temporary')).toHaveText('+123')
  await page.evaluate(() => document.fonts.ready)
  const contained = await health.evaluate(health => {
    const bounds = health.getBoundingClientRect()
    return [...health.querySelectorAll('.health-heart,.health-readout strong,.health-readout small,.health-temporary')].every(node => {
      const box = node.getBoundingClientRect()
      return box.left >= bounds.left - .5 && box.right <= bounds.right + .5 && box.top >= bounds.top - .5 && box.bottom <= bounds.bottom + .5
    })
  })
  expect(contained).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('the simple counter retains menu edits and death saves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const api = await sheetFixture(page)
  api.document().values.race = { name: 'Полуэльф' }
  api.document().values.classes = [{ name: 'Плут', level: 3 }]
  await page.goto('/char/test')
  const heading = page.locator('.dnd-heading')
  await expect(heading).not.toContainText('Полуэльф')
  await heading.getByRole('button', { name: 'Действия персонажа', exact: true }).click()
  await expect(page.locator('.ram-heading')).toContainText('Полуэльф')
  await page.getByRole('menuitem', { name: /^Изменить HP/ }).click()
  const health = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  await health.getByRole('button', { name: '4', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('14/23')
  await page.evaluate(() => document.fonts.ready)
  const numberWidth = (await heading.locator('.health-readout strong').boundingBox()).width
  await expect.poll(() => api.document().values.hp.current).toBe(14)
  await health.getByRole('button', { name: '2', exact: true }).click()
  await health.getByRole('button', { name: '0', exact: true }).click()
  await health.getByRole('button', { name: 'Урон', exact: true }).click()
  await expect(heading.locator('.health-readout')).toHaveText('0/23')
  const number = heading.locator('.health-readout strong')
  expect((await number.boundingBox()).width).toBeLessThan(numberWidth)
  const naturalWidth = await number.evaluate(node => {
    const text = document.createRange()
    text.selectNodeContents(node)
    return text.getBoundingClientRect().width
  })
  expect((await number.boundingBox()).width).toBeCloseTo(naturalWidth, 1)
  await expect(health.getByRole('button', { name: 'Успехи: 1' })).toBeVisible()
})

test('the ECG pen follows the fixed peaks and dips, pauses and respects reduced motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await sheetFixture(page)
  await page.goto('/char/test')
  const health = page.locator('.heading-health'), beat = health.locator('.health-beat'), head = beat.locator('.health-beat-head')
  await expect(head).toHaveCSS('animation-duration', '6s')
  await expect(beat).toHaveCSS('transform', 'none')
  const frames = await health.evaluate(node => {
    const wave = node.querySelector('.health-beat'), pen = wave.querySelector('.health-beat-head')
    const animations = [...wave.querySelectorAll('path')].map(path => path.getAnimations()[0])
    animations.forEach(animation => animation.pause())
    const total = pen.getTotalLength()
    return [{ x: 20, y: 17 }, { x: 59, y: 4 }, { x: 69, y: 28 }].map(point => {
      let low = 0, high = total
      for (let i = 0; i < 24; i++) {
        const middle = (low + high) / 2
        if (pen.getPointAtLength(middle).x < point.x) low = middle
        else high = middle
      }
      // Place the short pen stroke across the target corner, not beyond it.
      const time = ((low + high) / (2 * total) + .006) * 3300
      animations.forEach(animation => { animation.currentTime = time })
      const style = getComputedStyle(pen), number = node.querySelector('.health-readout strong').getBoundingClientRect()
      return {
        onTrajectory: pen.isPointInStroke(new DOMPoint(point.x, point.y)),
        onBaselineAtPeak: pen.isPointInStroke(new DOMPoint(59, 17)),
        offset: parseFloat(style.strokeDashoffset), opacity: Number(style.opacity),
        numberX: number.x, numberWidth: number.width,
      }
    })
  })
  expect(frames.every(frame => frame.onTrajectory)).toBe(true)
  expect(frames.every(frame => !frame.onBaselineAtPeak)).toBe(true)
  expect(frames[1].offset).toBeLessThan(frames[0].offset)
  expect(frames[2].offset).toBeLessThan(frames[1].offset)
  expect(frames[1].opacity).toBeCloseTo(.24, 2)
  expect(frames[1].numberX).toBeCloseTo(frames[0].numberX, 1)
  expect(frames[1].numberWidth).toBeCloseTo(frames[0].numberWidth, 1)
  await page.locator('.dnd-heading').screenshot({ path: testInfo.outputPath('ecg-dip.png') })
  await beat.evaluate(node => {
    node.querySelectorAll('path').forEach(path => { path.getAnimations()[0].currentTime = 4800 })
  })
  await expect(head).toHaveCSS('opacity', '0')
  await expect(beat.locator('.health-beat-trail')).toHaveCSS('opacity', '0')
  await beat.evaluate(node => node.querySelectorAll('path').forEach(path => path.getAnimations()[0].play()))
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(head).toHaveCSS('animation-play-state', 'paused')
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(head).toHaveCSS('animation-play-state', 'running')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(head).toHaveCSS('animation-name', 'none')
  await expect(head).toHaveCSS('opacity', '0')
  await expect(beat.locator('.health-beat-memory')).toHaveCSS('opacity', '0.09')
  await expect(health.locator('.health-readout')).toHaveText('18/23')
})

test('HP percentage changes pulse speed without replacing or resetting the strokes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const api = await sheetFixture(page)
  Object.assign(api.document().values.hp, { current: 50, max: { base: 100, bonuses: [] }, temp: 500 })
  await page.goto('/char/test')
  const beat = page.locator('.health-beat')
  const rates = () => beat.evaluate(node => node.getAnimations({ subtree: true }).map(animation => animation.playbackRate))
  await expect.poll(rates).toEqual([1.5, 1.5, 1.5])
  await beat.evaluate(node => {
    window.headerPulseSnapshot = node.getAnimations({ subtree: true })
    window.headerPulseSnapshot.forEach(animation => { animation.pause(); animation.currentTime = 1234 })
  })
  await page.getByRole('button', { name: 'Действия персонажа', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Изменить HP/ }).click()
  const calculator = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  async function apply(amount, action, readout, rate) {
    for (const digit of String(amount)) await calculator.getByRole('button', { name: digit, exact: true }).click()
    await calculator.getByRole('button', { name: action, exact: true }).click()
    await expect(page.locator('.health-readout')).toHaveText(readout)
    await expect.poll(rates).toEqual([rate, rate, rate])
    expect(await beat.evaluate(node => node.getAnimations({ subtree: true }).every((animation, index) => animation === window.headerPulseSnapshot[index] && animation.currentTime === 1234))).toBe(true)
  }
  await apply(500, 'Урон', '50/100', 1.5) // Temporary HP do not affect the rate.
  await apply(40, 'Урон', '10/100', 2.5)
  await apply(90, 'Лечение', '100/100', 1)
  await apply(100, 'Урон', '0/100', 3)
  await apply(10, 'Лечение', '10/100', 2.5)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(beat.locator('.health-beat-head')).toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(rates).toEqual([2.5, 2.5, 2.5])
})
