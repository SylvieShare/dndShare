import { expect, test } from '@playwright/test'
import { fixture } from '../tutorials/fixtures/character-layout'

for (const width of [390, 834, 1440]) test(`personality uses the shared inline editor and preserves rich text at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  const api = await fixture(page)
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggestTypes: [], suggests: {}, books: [] } } }))
  Object.assign(api.document().values, { person_traits: '<p><b>Любознательная</b> путешественница.</p>', person_ideals: '<p>Свобода.</p>' })
  await page.goto('/char/test')
  await page.getByRole(width >= 1200 ? 'tab' : 'button', { name: 'Личность', exact: true }).click()
  const field = page.locator('[data-sheet-field="person_traits"]:visible')
  await expect(field.locator('b')).toHaveText('Любознательная')
  await field.getByRole('button', { name: 'Редактировать', exact: true }).click()
  const editor = field.locator('[contenteditable="true"]')
  await expect(editor).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await editor.fill('Смелая путешественница.')
  await field.getByRole('button', { name: 'Готово', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(field).toContainText('Смелая путешественница.')
  await expect.poll(() => api.document().values.person_traits).toContain('Смелая путешественница.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: `target/personality-${width}.png`, fullPage: true })
})
