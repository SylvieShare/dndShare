import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'
import { openSessionPanel } from './fixtures/session-menu'

for (const width of [390, 834, 1440]) test(`session menu and transfer references at ${width}`, async ({ page }, testInfo) => {
  const mobile = width < 768
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width, height: 900 })
  const character = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Торин', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } }
  const session = { uuid: 'campaign', name: 'Тайны долины' }
  const item = { id: 42, name: 'Верёвка', typeId: 2, iconImageUrl: '/static/tab-stats.svg', data: { desc: 'Описание из справочника' } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [{ flowId: 'character', sourceKey: 'edition:1', device: mobile ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION, status: 'completed' }] }
    else if (path === '/api/char/recipient') json = character
    else if (path === '/api/char/recipient/version') json = { version: 1 }
    else if (path === '/api/char/recipient/sessions') json = { sessions: [session] }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/items/by-ids') json = { items: [item] }
    else if (path === '/api/char/recipient/item-transfers') json = { transfers: [1, 2].map(id => ({ id, senderCharUuid: 'sender', recipientCharUuid: 'recipient',
      senderName: 'Лиора', senderImageUrl: '/static/tab-stats.svg', recipientName: 'Торин', itemName: 'Верёвка', source: 'items', entry: { item_id: 42, count: 1 }, status: 'pending' })) }
    else if (path === '/api/sessions/campaign') json = { session, participants: [{ charUuid: 'recipient', templateId: 1, data: character.data },
      { charUuid: 'sender', templateId: 1, data: { values: { name: 'Лиора' } } }] }
    await route.fulfill({ json })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/char/recipient')
  if (mobile) await page.getByRole('button', { name: 'Предметы', exact: true }).click()
  const header = page.locator('.character-workspace-header')
  const labels = ['Сессия', 'Отдых и рассвет', 'Меню персонажа']
  const boxes = []
  for (const label of labels) {
    const button = header.getByRole('button', { name: label, exact: true })
    await expect(button).toBeVisible()
    boxes.push(await button.boundingBox())
    await expect(button.locator('svg').first()).toHaveAttribute('width', '24')
  }
  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBe(48)
    expect(box.height).toBe(48)
    expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(1)
    if (index) expect(box.x).toBeGreaterThanOrEqual(boxes[index - 1].x + 48)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
  }
  expect((await header.locator('.dnd-heading').boundingBox()).width).toBeGreaterThan(100)
  await testInfo.attach('session-header', { body: await header.screenshot(), contentType: 'image/png' })
  await header.getByRole('button', { name: 'Отдых и рассвет', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Короткий отдых', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await header.getByRole('button', { name: 'Сессия', exact: true }).click()
  const sessionMenu = page.getByRole('menu', { name: 'Сессия', exact: true })
  await expect(sessionMenu).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')))
  await expect(sessionMenu).toBeVisible()
  await page.keyboard.press('Escape')
  await openSessionPanel(page, 'Игроки')
  const players = page.getByRole('dialog', { name: 'Другие игроки', exact: true })
  await expect(players).toBeVisible()
  await players.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await openSessionPanel(page, 'События')
  const dialog = page.getByRole('dialog', { name: 'События', exact: true })
  const rows = dialog.locator('.transfer-event')
  await expect(rows).toHaveCount(2)
  expect((await dialog.boundingBox()).x).toBeGreaterThanOrEqual(0)
  await expect(rows.first().locator('.transfer-person img')).toBeVisible()
  await expect(rows.first().locator('.transfer-reference img')).toBeVisible()
  await expect(rows.nth(1)).toHaveClass(/base-tile--framed/)
  expect(await rows.nth(1).evaluate(el => getComputedStyle(el, '::before').borderTopWidth)).toBe('1px')
  await rows.first().getByRole('button', { name: 'Верёвка', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const reference = page.getByRole('dialog', { name: 'Верёвка', exact: true })
  await expect(reference).toBeVisible()
  await expect(reference).toContainText('Описание из справочника')
})
