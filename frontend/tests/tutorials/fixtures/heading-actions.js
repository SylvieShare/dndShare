import { expect } from '@playwright/test'
import { fixture } from './character-layout.js'

export async function checkHeadingActions(page, { width, owner = true, rootUrl = '', capture } = {}) {
  const api = await fixture(page, 'DND5', owner)
  if (!owner) {
    api.document().values.WIS.value.base = 10
    api.document().var.stats['5'] = 0
    api.document().values.INT.value.base = 8
    api.document().var.stats['4'] = -1
  }
  await page.goto(rootUrl + '/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const heading = page.locator('.dnd-heading')
  await expect(heading).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const before = structuredClone(api.writes)
  await expect(heading.locator('button button')).toHaveCount(0)
  await expect(page.locator('.heading-editors .armor-tile,.heading-editors .util-tile')).toHaveCount(0)
  const armor = heading.getByRole('button', { name: /^Класс доспеха / })
  if (owner) {
    await armor.click()
    const editor = page.getByRole('dialog', { name: 'Класс доспеха', exact: true })
    await expect(editor.getByText('Дополнительные бонусы', { exact: true })).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
  } else await expect(armor).toBeDisabled()
  expect(api.writes).toEqual(before)

  await heading.getByRole('button', { name: /^Здоровье:/ }).click()
  const health = page.getByRole('dialog', { name: 'Здоровье', exact: true })
  await expect(health).toBeVisible()
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes).toEqual(before)
  if (owner) {
    await expect(health.getByRole('button', { name: 'Урон', exact: true })).toBeVisible()
    if (width === 475) {
      await health.getByRole('button', { name: '2', exact: true }).click()
      await health.getByRole('button', { name: 'Урон', exact: true }).click()
      await expect(heading.locator('.health-readout')).toHaveText('16/23')
      await expect.poll(() => api.document().values.hp.current).toBe(16)
    }
  } else {
    await expect(health.locator('.hp-details')).toBeVisible()
    await expect(health.getByRole('button', { name: /Урон|Лечение|Временные/ })).toHaveCount(0)
  }
  await page.keyboard.press('Escape')
  await expect(health).toHaveCount(0)
  const afterHealth = structuredClone(api.writes)

  for (const [label, value, formula, key] of [
    ['Пассивное внимание', owner ? 13 : 10, owner ? '10 +3 = 13' : '10 +0 = 10', 'Enter'],
    ['Пассивное расследование', owner ? 12 : 9, owner ? '10 +2 = 12' : '10 -1 = 9', 'Space'],
  ]) {
    const button = heading.getByRole('button', { name: `${label} ${value}`, exact: true })
    await button.focus()
    await page.keyboard.press(key)
    const description = page.getByRole('dialog', { name: label, exact: true })
    await expect(description).toBeVisible()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(description.locator('.passive-formula strong')).toHaveText(formula)
    await expect(description.getByText(/Используется без броска костей/)).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    const bounds = await description.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    if (capture && label === 'Пассивное внимание') await capture(page, width, owner)
    if (key === 'Enter') await page.keyboard.press('Escape')
    else await button.click()
    await expect(description).toHaveCount(0)
  }
  await heading.getByRole('button', { name: 'Действия персонажа', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: owner ? 'Изменить HP' : 'Здоровье', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes).toEqual(afterHealth)
  if (!owner || width !== 475) expect(api.writes).toEqual(before)
  const controls = await heading.locator('.heading-armor,.heading-health,.heading-metrics').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
  }))
  for (const control of controls) expect(control.right).toBeLessThanOrEqual(width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  return { width, owner, armorEditor: owner, healthMode: owner ? 'calculator' : 'read-only',
    passiveKeyboard: ['Enter', 'Space'], passiveDescriptions: 2, nestedButtons: false, menuPreserved: true, controls,
    hpMutationChecked: owner && width === 475, noUnexpectedWrites: true }
}
