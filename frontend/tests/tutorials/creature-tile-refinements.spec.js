import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) test(`narrow creature tile, fitted name and external roll ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1200, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/tutorials/fixtures/participant-controls.html')
  const tile = page.locator('.enc-row'), rail = page.locator('.p-card')
  expect((await tile.boundingBox()).width).toBeLessThanOrEqual(400)
  const stats = await rail.locator('.participant-stats').boundingBox()
  const indicators = await rail.locator('.participant-stat').evaluateAll(nodes => nodes.map(n => ({ x: n.getBoundingClientRect().x, width: n.getBoundingClientRect().width })))
  expect(indicators[0].x).toBeCloseTo(stats.x, 1)
  expect(indicators.at(-1).x + indicators.at(-1).width - stats.x).toBeLessThan(stats.width - 8)
  const name = 'Древний хранитель забытого подземелья'
  await page.evaluate(name => {
    window.controls.encounter.npcName = () => name
    window.controls.npc.initiative = 123
    window.controls.npc.side = 'enemy'
    window.controls.state.challenge = true
  }, name)
  const text = tile.locator('.p-name-text')
  await expect(text).toHaveText(name)
  await expect(tile.getByLabel('Инициатива: 123')).toBeVisible()
  await expect.poll(() => text.evaluate(n => parseFloat(getComputedStyle(n).fontSize))).toBeLessThan(13)
  const nameBox = await text.boundingBox(), initiative = await tile.locator('.combatant-initiative').boundingBox(), row = await tile.locator('.p-name-row').boundingBox()
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(initiative.x + .5)
  expect(initiative.x + initiative.width).toBeLessThanOrEqual(row.x + row.width + .5)
  expect(await tile.evaluate(n => getComputedStyle(n, '::after').backgroundImage)).toContain('repeating-linear-gradient')
  await expect(tile.locator('.enc-badge')).toHaveCount(0)
  await expect(tile.locator('.ecr-result')).toHaveCount(0)
  const result = page.locator('.enc-row-result')
  await expect(result).toBeVisible()
  const tileBox = await tile.boundingBox(), resultBox = await result.boundingBox()
  if (mobile) expect(resultBox.y).toBeGreaterThanOrEqual(tileBox.y + tileBox.height)
  else expect(resultBox.x).toBeGreaterThanOrEqual(tileBox.x + tileBox.width)
  await page.evaluate(() => { window.controls.encounter.npcName = () => 'Огр' })
  await expect.poll(() => text.evaluate(n => parseFloat(getComputedStyle(n).fontSize))).toBe(13)
})
