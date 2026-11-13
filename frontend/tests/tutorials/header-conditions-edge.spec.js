import { test, expect } from '@playwright/test'
import { fixture } from './fixtures/character-layout'

async function open(page, width, inspiration) {
  await page.setViewportSize({ width, height: 500 })
  const api = await fixture(page)
  api.document().values.inspiration = inspiration
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [],
    metadata: { types: [], suggests: {}, suggestTypes: [], books: [] },
  } }))
  await page.goto('/char/test')
  await expect(page.locator('[data-sheet-navigation]')).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return api
}

for (const width of [390, 834, 1440]) for (const inspiration of [false, true]) {
  test(`top edge has no residual band and conditions stay fixed at ${width} (conditions=${inspiration})`, async ({ page }, testInfo) => {
    const api = await open(page, width, inspiration)
    const header = page.locator('.character-workspace-header'), strip = header.locator('.character-summary-strip')
    const scroller = page.locator(width < 1200 ? '.mobile-swipe-pane:not([inert]) .mobile-pane-scroll' : '.sheet-scroll')
    await expect.poll(() => scroller.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(180)
    await expect(strip).toHaveCount(inspiration ? 1 : 0)
    await expect(header.getByRole('button',{name:'Добавить состояние',exact:true})).toHaveCount(0)
    const initial = await header.boundingBox()
    await scroller.evaluate(node => { node.scrollTop = 180 })
    await expect(header).toHaveAttribute('data-workspace-scrolled', '')
    if (inspiration) {
      await expect(strip.getByRole('button', { name: 'Вдохновение', exact: true })).toBeInViewport()
      expect(await strip.evaluate(node => node.inert)).toBe(false)
      await expect(strip).not.toHaveAttribute('aria-hidden', 'true')
    }
    expect((await header.boundingBox()).height).toBeCloseTo(initial.height, 0)
    await testInfo.attach(`conditions-scrolled-${width}-${inspiration}`, { body: await header.screenshot(), contentType: 'image/png' })
    // Inspect the same turn as the scroll event, before an opacity fade could finish.
    const top = await scroller.evaluate(node => {
      node.scrollTop = 0
      node.dispatchEvent(new Event('scroll'))
      const header = document.querySelector('.character-workspace-header')
      const shadow = getComputedStyle(header, '::after')
      return { visibility: shadow.visibility, opacity: shadow.opacity, transition: shadow.transitionDuration }
    })
    expect(top).toEqual({ visibility: 'hidden', opacity: '0', transition: '0s' })
    await expect(header).not.toHaveAttribute('data-workspace-scrolled')
    await expect.poll(() => scroller.evaluate(node => {
      const header = document.querySelector('.character-workspace-header')
      return Math.abs(node.getBoundingClientRect().top - header.getBoundingClientRect().bottom)
    })).toBeLessThan(.5)
    const gap = await page.locator('.stat-block:visible').first().evaluate(node => node.getBoundingClientRect().top
      - document.querySelector('.character-workspace-header').getBoundingClientRect().bottom)
    expect(gap).toBeGreaterThanOrEqual(-.5)
    expect(gap).toBeLessThanOrEqual(20.5)
    expect(api.writes).toEqual([])
  })
}

test('removing the last condition collapses the row and keeps addition in the character menu', async ({ page }) => {
  const api = await open(page, 390, true)
  const header = page.locator('.character-workspace-header'), strip = header.locator('.character-summary-strip')
  const height = (await header.boundingBox()).height
  await strip.getByRole('button', { name: 'Вдохновение', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Убрать', exact: true }).click()
  await expect(strip).toHaveCount(0)
  await expect(header.locator('.workspace-header-context')).toHaveCount(0)
  await expect.poll(() => api.document().values.inspiration).toBe(false)
  await expect.poll(async () => (await header.boundingBox()).height).toBeLessThan(height)
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  await page.getByRole('menuitem',{name:'Добавить состояние',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Эффекты и состояния',exact:true})).toBeVisible()
})
