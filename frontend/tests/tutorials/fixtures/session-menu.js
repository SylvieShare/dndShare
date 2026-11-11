import { expect } from '@playwright/test'

export async function openSessionPanel(page, label) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const trigger = page.locator('.character-workspace-header').getByRole('button', { name: 'Сессия', exact: true })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('menuitem', { name: new RegExp(`^${label}`) }).click()
}
