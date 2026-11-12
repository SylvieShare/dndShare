import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function sheetFixture(page) {
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  return api
}

for (const width of [390, 834, 1440]) test(`HP, shield and stacked passives share a row at ${width}`, async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  const api = await sheetFixture(page)
  Object.assign(api.document().values.hp, { current: 9, max: { base: 18, bonuses: [] }, temp: 5 })
  await page.goto('/char/test')
  expect(await page.evaluate(async () => {
    const fonts = await document.fonts.load('700 20px "Cormorant Garamond"')
    await document.fonts.ready
    return fonts.length > 0
  })).toBe(true)
  const heading = page.locator('.dnd-heading'), health = heading.locator('.heading-health')
  await expect(health).toHaveAttribute('aria-label', 'Здоровье: 9 из 18, временные 5')
  await expect(health.locator('.health-readout')).toHaveText('9/18')
  await expect(health.locator('.health-temporary')).toHaveText('+5')
  await expect(health.locator('.health-beat')).toBeVisible()
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
      fields: [...node.querySelectorAll('.heading-metrics > span')].map(field => {
        const rect = field.getBoundingClientRect()
        return { left: rect.left, top: rect.top, bottom: rect.bottom }
      }),
    }
  })
  await testInfo.attach('header-composition', { body: await page.locator('.character-workspace-header').screenshot(), contentType: 'image/png' })
  expect(numbers.x + numbers.width).toBeLessThan(temp.x)
  expect(hp.x).toBeGreaterThan(armor.x + armor.width)
  expect(Math.abs(hp.y + hp.height / 2 - armor.y - armor.height / 2)).toBeLessThan(1)
  expect(combat.top).toBeGreaterThanOrEqual(name.bottom - .5)
  expect(fields).toHaveLength(2)
  for (const field of fields) {
    expect(field.left, JSON.stringify({ combat, armor, hp, fields })).toBeGreaterThan(hp.x + hp.width)
    expect(field.top).toBeGreaterThanOrEqual(hp.y - 1)
    expect(field.bottom).toBeLessThanOrEqual(hp.y + hp.height + 1)
  }
  expect(fields[1].top).toBeGreaterThanOrEqual(fields[0].bottom - .5)
  await expect(health.locator('strong')).toHaveCSS('font-weight', '700')
  expect(await health.locator('strong').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Cormorant Garamond')
  // Transformed bounds may exceed the CSS width by a floating-point fraction.
  expect((await heading.boundingBox()).width).toBeLessThanOrEqual(420.5)
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
  await heading.click()
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
  expect((await heading.locator('.health-readout strong').boundingBox()).width).toBeCloseTo(numberWidth, 1)
  await expect(health.getByRole('button', { name: 'Успехи: 1' })).toBeVisible()
})

test('the background beat travels, pauses in the background and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await sheetFixture(page)
  await page.goto('/char/test')
  const health = page.locator('.heading-health'), beat = health.locator('.health-beat')
  await expect(beat).toHaveCSS('animation-duration', '6s')
  const frames = await health.evaluate(node => {
    const wave = node.querySelector('.health-beat'), animation = wave.getAnimations()[0]
    animation.pause()
    return [900, 2700, 4800].map(time => {
      animation.currentTime = time
      const style = getComputedStyle(wave), number = node.querySelector('.health-readout strong').getBoundingClientRect()
      return { x: new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity), numberX: number.x, numberWidth: number.width }
    })
  })
  expect(frames[1].x).toBeGreaterThan(frames[0].x)
  expect(frames[1].opacity).toBeGreaterThan(0)
  expect(frames[1].opacity).toBeLessThanOrEqual(.15)
  expect(frames[2].opacity).toBe(0)
  expect(frames[1].numberX).toBeCloseTo(frames[0].numberX, 1)
  expect(frames[1].numberWidth).toBeCloseTo(frames[0].numberWidth, 1)
  await beat.evaluate(node => node.getAnimations()[0].play())
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(beat).toHaveCSS('animation-play-state', 'paused')
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(beat).toHaveCSS('animation-play-state', 'running')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(beat).toHaveCSS('animation-name', 'none')
  await expect(beat).toHaveCSS('opacity', '0.09')
  await expect(health.locator('.health-readout')).toHaveText('18/23')
})
