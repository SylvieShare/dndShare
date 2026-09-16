import { test, expect } from '@playwright/test'
for (const mobile of [false, true]) test(`NPC history ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1200, height: 900 })
  await page.goto('/tests/tutorials/fixtures/npc-history.html')
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('История урона и эффектов', { exact: true }).click()
  await expect(page.locator('.npc-history')).toContainText('Огненный шар')
  await expect(page.locator('.impact-hp')).toContainText('7')
  await expect(page.locator('.impact-temp')).toContainText('Поглощено 2')
  await expect(page.locator('.application-effect')).toContainText('Горение')
  await expect(page.locator('.application-effect')).toContainText('2')
})
