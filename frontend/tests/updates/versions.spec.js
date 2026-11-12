import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fixture } from '../tutorials/fixtures/character-layout'
const release = JSON.parse(readFileSync(new URL('../../../release/versions.json', import.meta.url), 'utf8'))

for (const width of [390, 834, 1440]) test(`sidebar reports the actual frontend and live backend at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await fixture(page)
  await page.route('**/api/build-info', route => route.fulfill({ json: { backend: { version: '0.9.4', build: 22, commitSha: 'a'.repeat(40), apiContract: 1 }, frontend: { version: '9.0.0', build: 999 } } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } } }))
  await page.goto('/chars')
  if (width < 1200) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const versions = page.getByRole('button', { name: new RegExp(`Версии: фронт ${release.frontend.version}, бэк 0.9.4`) })
  await expect(versions).toBeVisible({ timeout: 15000 })
  await expect(versions).toContainText(`Фронт ${release.frontend.version}`)
  await expect(versions).toContainText('Бэк 0.9.4')
  await expect(versions).not.toContainText('9.0.0')
  await versions.click()
  const panel = page.getByRole('dialog', { name: 'Версии приложения', exact: true })
  await expect(panel).toContainText('Бэкенд 0.9.4')
  await expect(panel).toContainText('aaaaaaaa')
  await page.keyboard.press('Escape')
  if (width >= 1200) {
    await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click()
    await expect(versions).toBeVisible()
    await versions.click()
    await expect(panel).toBeVisible()
  }
})
