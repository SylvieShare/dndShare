import { expect } from '@playwright/test'
import { designMediaQueries } from '../../../src/app/design-tokens.js'

export async function sheetTool(page, name) {
  const header = page.locator('.character-workspace-header')
  const phone = await page.evaluate(query => matchMedia(query).matches, designMediaQueries['--ui-phone'])
  if (!phone) return header.getByRole('button', { name, exact: true })

  const gear = header.getByRole('button', { name: 'Меню персонажа', exact: true })
  if (await gear.getAttribute('aria-expanded') !== 'true') await gear.click()
  return page.locator('[data-tutorial="character-menu"]').getByRole('button', { name, exact: true })
}

export async function openSessionPanel(page, label) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const trigger = await sheetTool(page, 'Сессия')
  await trigger.click()
  await page.getByRole('menu', { name: 'Сессия', exact: true })
    .getByRole('menuitem', { name: new RegExp(`^${label}`) }).click()
}
