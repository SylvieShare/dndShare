import { expect, test } from '@playwright/test'
import { DND_ALIGNMENTS } from '../../src/shared/lib/dndAlignment.js'
import { fixture } from '../tutorials/fixtures/character-layout.js'

for (const width of [320, 475, 834, 1440]) test(`alignment icons keep selection and captions usable at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const api = await fixture(page)
  api.document().values.person_alignment = 'Нейтральный'
  await page.goto('/char/test?tab=personality', { waitUntil: 'networkidle' })
  const trigger = page.locator('.alignment-trigger:visible')
  await trigger.click()
  const grid = page.getByRole('grid', { name: 'Мировоззрение' })
  await expect(grid.getByRole('gridcell')).toHaveCount(9)
  await expect(grid.locator('.lucide')).toHaveCount(9)
  const cells = await grid.getByRole('gridcell').evaluateAll(nodes => nodes.map(node => {
    const icon = node.querySelector('.lucide').getBoundingClientRect()
    const label = node.querySelector('.share-choice-card__label').getBoundingClientRect()
    return { iconBottom: icon.bottom, labelTop: label.top, overflow: node.scrollWidth > node.clientWidth }
  }))
  expect(cells.every(cell => cell.iconBottom <= cell.labelTop && !cell.overflow)).toBe(true)
  const bounds = await grid.locator('..').boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)

  for (const value of width === 475 ? DND_ALIGNMENTS : ['Хаотично-добрый']) {
    if (!await grid.isVisible()) await trigger.click()
    const option = grid.getByRole('gridcell', { name: value, exact: true })
    await option.focus()
    await page.keyboard.press('Enter')
    await expect(grid).toHaveCount(0)
    await expect.poll(() => api.document().values.person_alignment).toBe(value)
    await expect(trigger).toHaveText(value)
    await trigger.click()
    await expect(grid.getByRole('gridcell', { name: value, exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(grid).toHaveCount(0)
  }
  const selected = api.document().values.person_alignment
  await page.reload()
  await expect(trigger).toHaveText(selected)
})

test('a read-only character keeps its alignment without a picker', async ({ page }) => {
  const api = await fixture(page, 'DND5', false)
  api.document().values.person_alignment = 'Законно-добрый'
  await page.goto('/char/test?tab=personality')
  await expect(page.locator('.alignment-readonly:visible')).toHaveText('Законно-добрый')
  await expect(page.locator('.alignment-trigger')).toHaveCount(0)
  expect(api.writes).toEqual([])
})

test('the creation personality step uses the icon picker and updates its model', async ({ page }) => {
  await page.setViewportSize({ width: 475, height: 900 })
  await page.goto('/tests/character-create/persona.fixture.html')
  await page.getByRole('button', { name: 'Выбрать мировоззрение', exact: true }).click()
  const grid = page.getByRole('grid', { name: 'Мировоззрение' })
  await expect(grid.locator('.lucide')).toHaveCount(9)
  await grid.getByRole('gridcell', { name: 'Нейтрально-добрый', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.personaAlignment())).toBe('Нейтрально-добрый')
  await expect(page.locator('.alignment-trigger')).toHaveText('Нейтрально-добрый')
})
