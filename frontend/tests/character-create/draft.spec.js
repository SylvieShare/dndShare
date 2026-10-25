import { test, expect } from '@playwright/test'

for (const width of [1280, 390]) test(`compact wizard restores its own draft and scopes every catalogue (${width})`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  page.on('pageerror', error => { throw error })
  await page.addInitScript(() => {
    if (!localStorage.getItem('dnd-create-wizard-v2')) localStorage.setItem('dnd-create-wizard-v2', '{"name":"Полный визард","step":5}')
  })
  const catalogues = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const type = Number(url.searchParams.get('typeId'))
    let json = { items: [] }
    if (url.pathname === '/api/items') {
      catalogues.push(url.searchParams.get('sourceVersionId'))
      json = { items: type === 8 ? [{ id: 1, name: 'Человек', data: {} }] : type === 9 ? [{ id: 2, name: 'Воин', data: {} }] : [] }
    }
    if (url.pathname === '/api/suggest/batch') json = { items: {} }
    await route.fulfill({ json })
  })
  await page.goto('/tests/character-create/fixture.html')
  await expect(page.locator('.wz-select').first().getByRole('option', { name: 'Человек' })).toHaveCount(1)
  await page.getByPlaceholder('Введите имя...').fill('Из приглашения')
  await page.locator('.wz-select').first().selectOption('1')
  await page.locator('.wz-select').last().selectOption('2')
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  const scores = [15, 14, 13, 12, 10, 8]
  for (let i = 0; i < scores.length; i++) await page.locator('.sa-select').nth(i).selectOption(String(scores[i]))
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Создать', exact: true })).toBeEnabled()
  expect(catalogues.length).toBeGreaterThan(0)
  expect(catalogues.every(version => version === '7')).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dnd-create-wizard-v2')).name)).toBe('Полный визард')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  expect(await page.evaluate(() => window.created.name)).toBe('Из приглашения')
  expect(await page.evaluate(() => localStorage.getItem('dnd-create-compact-v1'))).toBeNull()
})
