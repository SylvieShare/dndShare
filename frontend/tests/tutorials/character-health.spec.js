import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function sheetFixture(page) {
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  return api
}

for (const width of [390, 834, 1440]) test(`HP, shield and stacked passives fit without overlap at ${width}`, async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
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
  await expect(heading.locator('.heading-armor-value')).toHaveText('11')
  const shieldCenter = await heading.locator('.heading-armor').evaluate(node => {
    const shield = node.querySelector('svg').getBoundingClientRect()
    const number = node.querySelector('.heading-armor-value').getBoundingClientRect()
    return { x: number.x + number.width / 2 - shield.x - shield.width / 2, y: number.y + number.height / 2 - shield.y - shield.height / 2 }
  })
  expect(Math.abs(shieldCenter.x)).toBeLessThan(1)
  expect(Math.abs(shieldCenter.y)).toBeLessThan(2)
  await expect(health).toHaveCSS('border-top-width', '1px')
  await expect(health.locator('.health-beat')).toHaveAttribute('aria-hidden', 'true')
  await expect(health.locator('[role="meter"]')).toHaveCount(0)
  await expect(heading.locator('canvas')).toHaveCount(0)
  const { numbers, temp, avatar, name, combat, armor, hp, fields } = await heading.evaluate(node => {
    const box = selector => node.querySelector(selector).getBoundingClientRect().toJSON()
    return {
      numbers: box('.health-summary'), temp: box('.health-temporary'),
      avatar: box('.portrait'), name: box('.identity'),
      combat: box('.heading-combat'), armor: box('.heading-armor'), hp: box('.heading-health'),
      fields: [...node.querySelectorAll('.heading-metric')].map(field => {
        const rect = field.getBoundingClientRect()
        return { left: rect.left, top: rect.top, bottom: rect.bottom }
      }),
    }
  })
  await testInfo.attach('header-composition', { body: await page.locator('.character-workspace-header').screenshot(), contentType: 'image/png' })
  expect(numbers.x + numbers.width).toBeLessThan(temp.x)
  expect(hp.x).toBeGreaterThan(armor.x + armor.width)
  expect(hp.x - armor.x - armor.width).toBeCloseTo(8, 1)
  expect(Math.abs(hp.y + hp.height / 2 - armor.y - armor.height / 2)).toBeLessThan(1)
  expect(combat.top).toBeGreaterThanOrEqual(name.bottom - .5)
  expect(fields).toHaveLength(2)
  const passivesWrapped = fields[0].top >= hp.bottom
  for (const field of fields) {
    if (passivesWrapped) {
      expect(field.top).toBeGreaterThanOrEqual(hp.bottom + 3.5)
      expect(field.left).toBeGreaterThanOrEqual(combat.left - .5)
    } else {
      expect(field.left - hp.right).toBeCloseTo(8, 1)
      expect(field.top).toBeGreaterThanOrEqual(hp.y - 1)
      expect(field.bottom).toBeLessThanOrEqual(hp.y + hp.height + 1)
    }
    expect(field.bottom).toBeLessThanOrEqual(combat.bottom + .5)
  }
  expect(fields[1].top).toBeGreaterThanOrEqual(fields[0].bottom - .5)
  await expect(health.locator('strong')).toHaveCSS('font-weight', '800')
  expect(await health.locator('strong').evaluate(node => getComputedStyle(node).fontFamily)).toBe(await heading.locator('.identity strong').evaluate(node => getComputedStyle(node).fontFamily))
  await expect(health).toHaveCSS('padding-left', '10px')
  await expect(health).toHaveCSS('padding-right', '10px')
  // Transformed bounds may exceed the CSS width by a floating-point fraction.
  expect((await heading.boundingBox()).width).toBeLessThanOrEqual(420.5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
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
  await page.getByRole('menuitem', { name: 'Изменить HP', exact: true }).click()
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
  await page.getByRole('menuitem', { name: 'Изменить HP', exact: true }).click()
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
