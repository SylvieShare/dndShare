import { test, expect } from '@playwright/test'
for (const width of [1280, 390]) test(`effect sources render and edit without reverse search (${width})`, async ({ page }) => {
 await page.setViewportSize({ width, height: 900 })
 page.on('pageerror', error => { throw error })
 let reverseRequests = 0, saved
 page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/items/') && new URL(request.url()).pathname.endsWith('/effect-sources')) reverseRequests++ })
 await page.route('**/api/**', async route => {
  if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue()
  if (route.request().method() === 'PUT') { saved = route.request().postDataJSON(); return route.fulfill({ status: 204 }) }
  return route.fulfill({ json: { items: [], types: await page.evaluate(() => window.testTypes || []) } })
 })
 await page.goto('/tests/weapon-charges/effect-sources.html')
 await expect(page.getByRole('button', { name: 'Заклинание-источник', exact: true })).toBeVisible()
 await expect(page.getByText('На цель · После попадания')).toBeVisible()
 await page.getByRole('button', { name: 'Изменить эффект' }).click()
 await page.getByRole('textbox', { name: 'Условие применения', exact: true }).fill('После завершения')
 await page.getByRole('button', { name: 'Источник', exact: true }).click()
 await expect(page.getByRole('dialog', { name: 'Выбрать предмет', exact: true })).toBeVisible()
 await page.keyboard.press('Escape')
 await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
 expect(saved.data.application_sources[0]).toMatchObject({ item: 900, target: 'other', condition: 'После завершения' })
 await expect(page.getByText('На цель · После завершения')).toBeVisible()
 expect(reverseRequests).toBe(0)
})
