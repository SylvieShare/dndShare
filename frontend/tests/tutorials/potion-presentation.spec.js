import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) test(`healing dice and inline stat geometry on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/') ? route.fulfill({ json: {} }) : route.continue())
  await page.goto('/tests/tutorials/fixtures/potion-presentation.html')
  const dice = page.locator('.rich-node--dice')
  await expect(dice).toBeVisible()
  for (const selector of ['.rich-node--dice .system-die', '.damage-preview .system-die']) {
    const colors = await page.locator(selector).evaluateAll(nodes => nodes.map(node => node.style.getPropertyValue('--system-die-color')))
    expect(colors.length).toBeGreaterThan(0)
    for (const color of colors) expect(color).toBe('var(--success)')
  }
  const diceBox = await dice.boundingBox()
  for (const selector of ['.rich-node--stat-hp', '.rich-node--stat-ac']) {
    expect((await page.locator(selector).boundingBox()).height).toBe(diceBox.height)
  }
  await dice.click()
  expect(await page.evaluate(() => window.presentationDice.stack[0].color)).toBe('var(--success)')
})
