import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { weaponSheetFixture } from './weapon-sheet.js'

const propertyName = 'Двуручное'
const propertyDescription = 'Для атаки этим оружием нужны две руки.'
const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))

export async function checkWeaponPropertySwipe(page, open) {
  const api = await weaponSheetFixture(page)
  await page.route('**/api/build-info', route => route.fulfill({
    json: { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend },
  }))
  api.catalogue[201].name = 'Короткий лук'
  api.catalogue[201].data.tags = [
    { id: 12, value: 'Дальнобойное' },
    { id: 13, value: propertyName, desc: propertyDescription },
  ]
  const weapons = api.document().values.weapon
  for (let index = 0; index < 4; index++) weapons.push({ ...weapons[0], uid: `bow-${index}` })
  await open()

  const navigation = page.locator('[data-sheet-navigation]')
  const weaponsTab = navigation.getByRole('button', { name: 'Оружие', exact: true })
  const magicTab = navigation.getByRole('button', { name: 'Магия', exact: true })
  const stage = page.locator('.mobile-swipe-stage')
  const pane = stage.locator('.mobile-swipe-pane:not([inert]) .mobile-pane-scroll')
  const property = pane.locator('[data-sortable-key="staff"]').getByRole('button', { name: propertyName, exact: true })
  const description = page.getByRole('dialog', { name: propertyName, exact: true })
  await expect(weaponsTab).toHaveAttribute('aria-current', 'page')

  const client = await page.context().newCDPSession(page)
  async function gesture(dx = 0, dy = 0, during) {
    await property.scrollIntoViewIfNeeded()
    const bounds = await property.boundingBox()
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    try {
      if (dx || dy) {
        for (const progress of [.25, .5, .75, 1]) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: start.x + dx * progress, y: start.y + dy * progress }],
          })
        }
      }
      if (during) await during()
    } finally {
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
  }
  try {
    await gesture()
    await expect(description).toContainText(propertyDescription)
    await description.getByRole('button', { name: 'Понятно' }).click()
    await expect(description).toHaveCount(0)
    await property.press('Enter')
    await expect(description).toContainText(propertyDescription)
    await page.keyboard.press('Escape')
    await expect(description).toHaveCount(0)

    const before = await pane.evaluate(node => node.scrollTop)
    await gesture(0, -110)
    await expect.poll(() => pane.evaluate(node => node.scrollTop)).toBeGreaterThan(before + 20)
    await expect(weaponsTab).toHaveAttribute('aria-current', 'page')
    await expect(description).toHaveCount(0)

    await gesture(-95, 0, () => expect(stage).toHaveClass(/\bdragging\b/, { timeout: 2500 }))
    await expect(magicTab).toHaveAttribute('aria-current', 'page')
    await expect(stage).not.toHaveClass(/dragging|settling/)
    await expect(description).toHaveCount(0)
    await expect(page.locator('.sortable-placeholder')).toHaveCount(0)
    expect(api.writes).toEqual([])
  } finally {
    await client.detach()
  }
}
