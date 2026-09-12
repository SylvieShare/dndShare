import { expect, test } from '@playwright/test'

const uuid = '11111111-1111-4111-8111-111111111111'
const combatants = Array.from({ length: 100 }, (_, i) => ({
  uid: `player-${i}`, type: 'player', name: `Очень длинное имя персонажа ${i}`,
  health: { kind: 'wounded', label: 'Ранен', current: 12, maximum: 24 }, states: [],
}))

async function setup(page, displayScale, mode = 'combat') {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/events')) return route.abort()
    if (path.endsWith('/presentation')) return route.fulfill({ json: {
      sessionName: 'Тест', mode, visible: true, effect: 'none', transition: 'cut', displayScale,
      showHealth: true, healthDisplay: 'numbers', showGraveyard: true, timers: [],
      material: { kind: 'note', noteStyle: 'letter', content: 'Длинное письмо без прокрутки. '.repeat(400) },
    } })
    if (path.endsWith('/encounter')) return route.fulfill({ json: {
      active: true, round: 1, currentUid: 'player-0', combatants,
      graveyard: Array.from({ length: 50 }, (_, i) => ({ key: `${i}`, name: `Гоблин ${i}`, count: i + 1 })),
    } })
    return route.fulfill({ json: { auth: false } })
  })
  await page.goto(`/screen/${uuid}`)
}

async function expectInsideViewport(page, selector) {
  const { width, height } = page.viewportSize()
  const bounds = await page.locator(selector).evaluateAll(elements => elements.map(el => {
    const { x, y, width, height } = el.getBoundingClientRect()
    return { name: el.className, x, y, width, height }
  }))
  expect(bounds.length).toBeGreaterThan(0)
  for (const box of bounds) {
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width, box.name).toBeLessThanOrEqual(width + 1)
    expect(box.y + box.height, box.name).toBeLessThanOrEqual(height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }, { width: 1024, height: 768 }, { width: 1920, height: 540 }, { width: 390, height: 844 }]) {
  for (const scale of [75, 100, 125]) {
    test(`combat fits ${size.width}x${size.height} at ${scale}% without login`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await setup(page, scale)
      await expect(page.locator('.turn-spotlight .encounter-health')).toHaveText('12/24 HP')
      await expectInsideViewport(page, '.turn-spotlight, .initiative-card, .encounter-queue__summary, .graveyard-card, .encounter-graveyard__more')
      await page.mouse.wheel(0, 1000)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      const overflows = await page.locator('.encounter-queue, .turn-spotlight__info').evaluateAll(els => els.filter(el => el.scrollHeight > el.clientHeight + 1).length)
      expect(overflows).toBe(0)
    })
  }
}

test('long note fits completely and refits after viewport resize', async ({ page }) => {
  await setup(page, 100, 'material')
  for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    await expect.poll(() => page.locator('.presentation-frame article').evaluate(el => {
      const style = getComputedStyle(el)
      return el.firstElementChild.scrollHeight <= el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    })).toBe(true)
    await expectInsideViewport(page, '.presentation-frame article > div')
  }
})
