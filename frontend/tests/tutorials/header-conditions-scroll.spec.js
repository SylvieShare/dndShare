import { expect, test } from '@playwright/test'
import { conditionRowFixture } from './fixtures/header-conditions.js'

test.use({ hasTouch: true })

for (const width of [390, 475, 834, 1440]) test(`header conditions scroll by touch without changing tabs at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 751 })
  const { api, names } = await conditionRowFixture(page)
  await page.goto('/char/test', { waitUntil: 'networkidle' })
  const header = page.locator('.character-workspace-header')
  const row = header.locator('.dsov-row')
  await expect(row.getByRole('button')).toHaveCount(names.length)
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => row.evaluate(node => node.scrollWidth - node.clientWidth)).toBeGreaterThan(50)
  const cardRows = await row.getByRole('button').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().top))).size)
  expect(cardRows).toBe(1)
  const activeBefore = await header.locator('[aria-current="page"]').allTextContents()
  const writesBefore = api.writes.length
  const height = (await header.boundingBox()).height
  const bounds = await row.boundingBox()
  const start = bounds.x + bounds.width - 20, end = bounds.x + 20, y = bounds.y + bounds.height / 2
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] })
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 8, y }] })
    await page.waitForTimeout(16)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await expect.poll(() => row.evaluate(node => node.scrollLeft)).toBeGreaterThan(30)
  expect(await header.locator('[aria-current="page"]').allTextContents()).toEqual(activeBefore)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(api.writes.length).toBe(writesBefore)

  await row.evaluate(node => { node.scrollLeft = node.scrollWidth })
  const last = row.getByRole('button', { name: names.at(-1), exact: true })
  await expect(last).toBeInViewport()
  await last.focus()
  await last.click()
  const menu = page.getByRole('menu', { name: `Действия: ${names.at(-1)}`, exact: true })
  await expect(menu.getByRole('menuitem', { name: 'Изменить длительность', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const add = header.getByRole('button', { name: 'Добавить состояние', exact: true })
  await expect(add).toBeInViewport()
  await add.click()
  await expect(page.getByRole('dialog', { name: 'Эффекты и состояния', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect((await header.boundingBox()).height).toBeCloseTo(height, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(api.writes.length).toBe(writesBefore)
})
