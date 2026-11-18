import { expect, test } from '@playwright/test'
import { rosterSelectionFixture } from './fixtures/session-roster.js'

test('manual NPC damage changes HP before the response and defeated rows survive reload', async ({ page }, info) => {
  let releaseImpact
  const delayedImpact = new Promise(resolve => { releaseImpact = resolve })
  const api = await rosterSelectionFixture(page, 1440, { beforeImpact: () => delayedImpact })
  const combatants = api.encounter().combatants
  combatants.find(row => row.uid === 'wolf').position = 'combat'
  combatants.find(row => row.uid === 'p-1').position = 'combat'
  combatants.push({ uid: 'old-defeat', type: 'npc', position: 'dead', override: { name: 'Старый НПС', hp: 8 }, hpCurrent: 0 })
  api.participants[0].data.values.hp.current = 0
  await page.reload()

  const sidebar = page.locator('aside.map-sidebar')
  await sidebar.getByRole('button', { name: 'Запас', exact: true }).click()
  await expect(sidebar.locator('[data-encounter-uid="old-defeat"]').getByRole('img', { name: 'Существо повержено' })).toBeVisible()
  await page.getByRole('button', { name: 'Свернуть боковую панель' }).click()
  await page.getByRole('button', { name: /Открыть бой/ }).click()
  const scene = page.locator('.enc-content')
  const wolf = scene.locator('[data-encounter-uid="wolf"]')
  const player = scene.locator('[data-encounter-uid="p-1"]')
  const controls = page.getByRole('complementary', { name: 'Управление боем' })
  await expect(controls.getByRole('button', { name: /Кладбище|Перебросить инициативу выбранным/ })).toHaveCount(0)
  await expect(player.getByRole('button', { name: /Спасброски от смерти/ })).toBeVisible()
  await info.attach('combat-preparation', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })

  await wolf.locator('.heading-health').click()
  const modal = page.getByRole('dialog', { name: 'Хиты' })
  try {
    await modal.getByRole('button', { name: '9', exact: true }).click()
    await modal.getByRole('button', { name: 'Урон', exact: true }).click()
    await expect(modal.locator('.hc-current')).toHaveText('6')
    await expect.poll(() => api.impacts.length).toBe(1)
    expect(api.encounter().combatants.find(row => row.uid === 'wolf').hpCurrent).toBe(15)
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(wolf.locator('.health-readout')).toHaveText('6/20')
  } finally {
    releaseImpact()
  }
  await expect.poll(() => api.encounter().combatants.find(row => row.uid === 'wolf').hpCurrent).toBe(6)
  await wolf.getByRole('checkbox').click()
  await controls.getByRole('button', { name: 'Отметить выбранных погибшими' }).click()
  await expect(wolf.getByRole('img', { name: 'Существо повержено' })).toBeVisible()
  await expect(wolf.getByRole('checkbox')).toHaveCount(0)
  await expect.poll(() => api.encounter().combatants.find(row => row.uid === 'wolf').defeatedOnScene).toBe(true)

  await page.reload()
  const openCombat = page.getByRole('button', { name: /Открыть бой/ })
  if (await openCombat.isVisible()) await openCombat.click()
  await expect(wolf.getByRole('button', { name: 'Воскресить существо' })).toBeVisible()
  await sidebar.getByRole('button', { name: 'Запас', exact: true }).click()
  await expect(sidebar.locator('[data-encounter-uid="wolf"]').getByRole('img', { name: 'Существо повержено' })).toBeVisible()
  await info.attach('defeated-in-place', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  expect(api.impacts).toHaveLength(1)
  expect(api.errors).toEqual([])
  expect(api.warnings).toEqual([])
})
