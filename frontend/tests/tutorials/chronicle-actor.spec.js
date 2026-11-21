import { expect, test } from '@playwright/test'
import { sessionLayout } from './fixtures/session-layout.js'

const creatureName = 'Член банды гоблинов'
const longName = 'Старший дозорный банды болотных гоблинов'

function event(id, name, letter) {
  return {
    id, type: 'initiative_roll', action: 'Инициатива', createdAt: '2026-11-22T10:00:00Z',
    authorIsSessionOwner: true, authorUserId: 1, actorName: name,
    actorImageUrl: '/static/tab-magic.svg',
    data: letter ? { npcActor: { uid: String(id), name, letter, color: '#e978a3' } } : {},
  }
}

test('chronicle overlays NPC letters and fits long names into two lines', async ({ page }, info) => {
  await page.setViewportSize({ width: 704, height: 932 })
  await sessionLayout(page, { url: '/sessions/test', participants: [] })
  const events = [event(3, creatureName, 'A'), event(2, longName, 'B'), event(1, 'Гоблин', null)]
  await page.route('**/api/sessions/test/events?**', route => route.fulfill({ json: { events } }))
  await page.getByRole('button', { name: 'Хроника', exact: true }).click()
  const groups = page.locator('.event-actor-group')
  await expect(groups).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)

  const group = groups.filter({ has: page.locator('.event-actor-name', { hasText: creatureName }) })
  const avatar = group.getByRole('img', { name: 'Метка A' })
  const marker = avatar.locator('.npc-marker')
  await expect(group.locator('.event-actor-name')).toHaveText(creatureName)
  await expect(marker).toHaveText('A')
  const [portrait, badge] = await Promise.all([avatar.boundingBox(), marker.boundingBox()])
  expect(badge.y).toBeCloseTo(portrait.y, 0)
  expect(badge.x + badge.width).toBeCloseTo(portrait.x + portrait.width, 0)
  await expect(groups.filter({ hasText: 'Гоблин' }).last().locator('.npc-marker')).toHaveCount(0)

  const longTitle = groups.filter({ hasText: longName }).locator('.event-actor-name > span')
  const fits = node => node.offsetHeight <= 2 * parseFloat(getComputedStyle(node).lineHeight) + 0.5
  await expect.poll(() => longTitle.evaluate(fits)).toBe(true)
  await page.screenshot({ path: info.outputPath('chronicle-704.png'), animations: 'disabled' })

  await page.setViewportSize({ width: 390, height: 932 })
  await expect.poll(() => longTitle.evaluate(fits)).toBe(true)
  await expect.poll(() => longTitle.evaluate(node =>
    parseFloat(getComputedStyle(node).fontSize) < parseFloat(getComputedStyle(node.parentElement).fontSize),
  )).toBe(true)
  const compactSize = await longTitle.evaluate(node => parseFloat(getComputedStyle(node).fontSize))
  await page.setViewportSize({ width: 1728, height: 1004 })
  await expect.poll(() => longTitle.evaluate(fits)).toBe(true)
  await expect.poll(() => longTitle.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThan(compactSize)
  await expect(group.locator('.event-actor-name > span')).toHaveCSS('font-size', '18px')
})
