import { test, expect } from '@playwright/test'

const mockApi = async page => {
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/')
    ? route.fulfill({ json: { types: [], items: [], presets: [], suggests: [] } })
    : route.continue())
}

for (const mobile of [false, true]) {
  test(`wallet belongs to the inventory card and edits only money (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    page.on('pageerror', error => { throw error })
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
    await mockApi(page)
    await page.goto('/tests/notifications/fixtures/inventory.html')
    const card = page.locator('.di-inventory')
    const wallet = card.locator('.inventory-wallet')
    const icon = wallet.getByRole('button', { name: 'Изменить кошелёк', exact: true })
    await expect(icon).toBeVisible()
    await expect(wallet.locator('.base-tile, .morph-tile-header')).toHaveCount(0)
    await expect(wallet.locator('[data-money-id="3"] .ma-value')).toHaveText('42')
    const [cardBox, walletBox, bagBox] = await Promise.all([card.boundingBox(), wallet.boundingBox(), card.locator('.di-space').first().boundingBox()])
    expect(walletBox.x + walletBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width)
    expect(cardBox.x + cardBox.width - walletBox.x - walletBox.width).toBeLessThan(25)
    expect(walletBox.y + walletBox.height).toBeLessThanOrEqual(bagBox.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1280)
    const inventoryBefore = await page.evaluate(() => window.readInventory())
    await icon.focus()
    await page.keyboard.press('Enter')
    const editor = page.locator('.mes-editor')
    await expect(editor).toBeVisible()
    await editor.getByRole('button', { name: '5', exact: true }).click()
    await editor.getByRole('button', { name: 'Взять', exact: true }).click()
    expect(await page.evaluate(() => window.readWallet().amounts[1])).toBe(15)
    expect(await page.evaluate(() => window.readInventory())).toEqual(inventoryBefore)
    expect(await page.evaluate(() => window.walletWrites.length)).toBe(1)
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    await expect(wallet.locator('[data-money-id="1"] .ma-value')).toHaveText('15')
  })
}

test('read-only inventory wallet has an icon and cannot open the calculator', async ({ page }) => {
  await mockApi(page)
  await page.goto('/tests/notifications/fixtures/inventory.html?viewer')
  const wallet = page.locator('.inventory-wallet')
  await expect(wallet.getByRole('img', { name: 'Кошелёк', exact: true })).toBeVisible()
  await expect(wallet.getByRole('button')).toHaveCount(0)
  await wallet.click()
  await expect(page.locator('.mes-editor')).toHaveCount(0)
  expect(await page.evaluate(() => window.walletWrites)).toEqual([])
})
