import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { sessionLayout } from './session-layout.js'

const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))

export async function checkSessionSidebarSwipe(page, navigate) {
  const participants = Array.from({ length: 16 }, (_, index) => ({
    charId: index + 1, charUuid: `player-${index}`, templateId: 1, sourceVersionId: 1, version: 1,
    data: { values: { name: `Игрок ${index + 1}`, hp: { current: 18, max: { base: 24 } }, armor: {} } },
  }))
  const api = await sessionLayout(page, {
    url: '/sessions/test',
    participants,
    encounter: {
      active: false, round: 0, turnIndex: 0,
      combatants: participants.map(({ charId, charUuid }) => ({
        uid: `p-${charId}`, type: 'player', charId, charUuid,
        position: 'reserve', initiative: null, surprised: false, tieBreak: charId,
      })),
    },
    navigate: async path => {
      await page.route('**/api/build-info', route => route.fulfill({
        json: { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend },
      }))
      await navigate(path)
    },
  })
  const sidebar = page.locator('.session-sidebar-host > aside')
  const panel = sidebar.locator('.map-sidebar-panel')
  const nav = sidebar.getByRole('navigation')
  const players = nav.getByRole('button', { name: 'Игроки', exact: true })
  const reserves = nav.getByRole('button', { name: 'Запас', exact: true })
  const roster = panel.locator('.session-roster-list:visible')
  const client = await page.context().newCDPSession(page)
  const drag = async ({ x, y }, dx, dy, check) => {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    try {
      for (const progress of [.25, .5, .75, 1]) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: x + progress * dx, y: y + progress * dy }],
        })
      }
      if (check) await check()
    } finally {
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
  }
  const inPanel = async locator => locator.evaluate(node => {
    const bounds = node.getBoundingClientRect()
    return { x: bounds.left + bounds.width * .7, y: bounds.top + Math.min(180, bounds.height / 2) }
  })
  const width = async locator => (await locator.boundingBox()).width
  const expectCollapsed = async () => {
    await expect(panel).toHaveAttribute('inert', '')
    await expect.poll(async () => Math.abs(await width(sidebar) - await width(nav))).toBeLessThanOrEqual(1)
  }

  try {
    await expectCollapsed()
    await players.click()
    await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
    await expect(panel).not.toHaveAttribute('inert', '')
    const controller = await sidebar.elementHandle()
    await expect(roster).toHaveAttribute('data-scrollable', 'true')

    const openWidth = await width(sidebar)
    await drag(await inPanel(roster), -44, 0, async () => {
      await expect(sidebar).toHaveClass(/map-sidebar--dragging/)
      expect(Math.abs(await width(sidebar) - (openWidth - 44))).toBeLessThanOrEqual(1)
      await expect(panel).not.toHaveCSS('transform', 'none')
    })
    await expect(sidebar).not.toHaveClass(/map-sidebar--dragging/)
    await expect.poll(() => width(sidebar)).toBeCloseTo(openWidth, 0)
    await expect(roster.getByRole('checkbox', { checked: true })).toHaveCount(0)

    await drag(await inPanel(roster), -140, 0)
    await expectCollapsed()
    const rail = await nav.boundingBox()
    await drag({ x: rail.x + rail.width - 9, y: rail.y + rail.height - 40 }, 120, 0)
    await expectCollapsed()

    await reserves.click()
    await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
    const reserve = panel.getByRole('region', { name: 'Запас существ' })
    await expect(reserve).toBeVisible()
    await drag(await inPanel(panel.locator('.map-sidebar-heading')), -140, 0)
    await expectCollapsed()

    await players.click()
    await expect(sidebar).not.toHaveClass(/map-sidebar--opening/)
    await drag(await inPanel(roster), 0, -130)
    await expect.poll(() => roster.evaluate(node => node.scrollTop)).toBeGreaterThan(20)
    await expect(panel).not.toHaveAttribute('inert', '')
    expect(await controller.evaluate(node => node.isConnected)).toBe(true)
    expect(api.writes).toEqual([])
  } finally {
    await client.detach()
  }
}
