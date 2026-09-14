import { test, expect } from '@playwright/test'
for (const mobile of [false, true]) test(`DM resolves an application to a named NPC and spell offers include DM on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  const requests = []
  await page.route('**/api/sessions/campaign/**', async route => {
    if (route.request().method() === 'POST') { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { transfer: {} } }) }
    await route.fulfill({ json: { targets: [{ kind: 'character', charUuid: 'hero', name: 'Лиора' }, { kind: 'npc', npcUid: 'goblin', encounterId: 3, name: 'Гоблин', letter: 'B', color: '#ff9900' }] } })
  })
  await page.goto('/tests/tutorials/fixtures/application-targets.html')
  await page.getByRole('button', { name: 'Принять применение', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'К кому применить' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Лиора', exact: true })).toBeVisible()
  const npc = modal.getByRole('button', { name: 'B Гоблин' })
  await expect(npc.locator('span').filter({ hasText: /^B$/ }).first()).toHaveCSS('color', 'rgb(255, 153, 0)')
  await npc.click()
  expect(requests[0]).toMatchObject({ decision: 'accept', target: { kind: 'npc', npcUid: 'goblin', encounterId: 3 } })
  await expect(modal).toHaveCount(0)
  await page.getByRole('button', { name: 'Заклинание', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Эффект «Ускорение» на…' }).click()
  await page.getByRole('menuitem', { name: 'Мастер — выберет цель' }).click()
  expect(await page.evaluate(() => window.sent)).toEqual(['spells', { uid: '990' }, 'dm', 'use', 'haste'])
})
