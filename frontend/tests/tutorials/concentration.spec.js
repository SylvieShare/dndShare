import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

for (const mobile of [false, true]) test(`concentration links and self application on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const spell = { id: 802, typeId: 5, name: 'Ускорение', data: { lvl: 3, concentration: true, status_effects: [{ key: 'haste', effect: { id: 801 }, concentration: true }] } }
  const effect = { id: 801, typeId: 15, name: 'Ускоренный', data: {} }
  const char = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Лиора', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    spells: { schema_version: 2, tabs: [{ key: 'wizard', name: 'Волшебник', casting_ability: 4, mode: 'prepared', spells: [{ key: 'haste', id: 802, prepared: true }] }], grants: [] },
  } } }
  let concentration = null
  const writes = []
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: [false, true].map(m => ({ flowId: 'character', sourceKey: 'edition:1', device: m ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION, status: 'completed' })) }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/char/hero') json = char
    else if (path.endsWith('/sessions')) json = { sessions: [] }
    else if (path.endsWith('/version')) json = { version: char.version }
    else if (path.startsWith('/api/items')) json = { items: [spell, effect] }
    else if (path.endsWith('/data')) { char.data = req.postDataJSON().data; char.version++; json = { version: char.version } }
    else if (path.endsWith('/concentration')) {
      if (req.method() === 'POST') { writes.push(req.postDataJSON()); concentration = null; char.version++ }
      json = { concentration }
    } else if (path.endsWith('/spell-cast')) {
      writes.push(req.postDataJSON()); char.version++
      concentration = { id: 'cast-1', spellId: 802, name: 'Ускорение', effects: [
        { uid: 'self', effectId: 801, target: { kind: 'character', name: 'Лиора' } },
        { uid: 'ally', effectId: 801, target: { kind: 'character', name: 'Торин' } },
        { uid: 'npc', effectId: 801, target: { kind: 'npc', name: 'Гоблин', letter: 'B', color: '#ff9900' } },
      ] }
      json = { self: { effects: [{ id: 801, name: 'Ускоренный' }] }, transfers: [] }
    }
    await route.fulfill({ json })
  })
  await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/char/hero')
  await expect(page.locator('.view')).toBeVisible()
  if (mobile) await page.getByRole('button', { name: 'Магия', exact: true }).click()
  else await page.getByRole('tab', { name: 'Магия', exact: true }).click()
  const block = page.locator('.spell-concentration:visible')
  await expect(block).toHaveCount(0)
  if (mobile) await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/settling/)
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.inner-tabs-content, .inner-tab-pane, .mobile-swipe-track')]
      .flatMap(el => el.getAnimations().map(animation => animation.finished.catch(() => {}))))
  })
  const row = page.locator('.spell-row:visible .sp-name').filter({ hasText: 'Ускорение' }).first()
  await expect(row).toBeVisible()
  await row.scrollIntoViewIfNeeded()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const bounds = await row.boundingBox()
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.getByRole('menuitem', { name: 'Использовать на…', exact: true }).click()
  await page.getByRole('menuitem', { name: 'На себя', exact: true }).click()
  await expect(block.locator('[aria-label="Торин"]')).toBeVisible()
  await expect(block).toHaveClass(/morph-tile/)
  await expect(block).toHaveCSS('margin-bottom', '16px')
  await expect(block.locator('.npc-marker')).toHaveCSS('color', 'rgb(255, 153, 0)')
  expect(writes[0]).toMatchObject({ spellId: 802, optionKey: 'haste' })
  await block.getByRole('button', { name: 'Прекратить', exact: true }).click()
  await expect(block).toHaveCount(0)
  expect(writes[1]).toMatchObject({ endId: 'cast-1' })
})
