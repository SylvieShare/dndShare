import { expect, test } from '@playwright/test'
import { conditionRowFixture } from './fixtures/header-conditions.js'

test.use({ hasTouch: true })

for (const width of [390, 475, 834, 1440, 1920]) test(`header conditions scroll by touch without changing tabs at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 751 })
  const { api, names } = await conditionRowFixture(page)
  await page.goto('/char/test', { waitUntil: 'networkidle' })
  const header = page.locator('.character-workspace-header')
  const row = header.locator('.dsov--header .dsov-row')
  await expect(row.locator('.dsov-effect')).toHaveCount(names.length)
  await expect(row.locator('.dsov-add')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => row.evaluate(node => node.scrollWidth - node.clientWidth)).toBeGreaterThan(50)
  await expect.poll(() => row.evaluate(node => {
    const viewport=node.getBoundingClientRect(),header=node.closest('.character-workspace-header').getBoundingClientRect()
    return Math.max(Math.abs(viewport.left-header.left),Math.abs(viewport.right-header.right))
  })).toBeLessThan(1)
  const cardRows = await row.locator('.dsov-effect').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().top))).size)
  expect(cardRows).toBe(1)
  // Check gutter painting before the gesture starts native scroll inertia.
  await row.evaluate(node => { node.scrollLeft = 12 })
  const gutter=await row.evaluate(node => {
    const viewport=node.getBoundingClientRect(),card=node.querySelector('.dsov-effect').getBoundingClientRect()
    const x=card.left+4,y=card.top+card.height/2
    return {offset:card.left-viewport.left,inset:parseFloat(getComputedStyle(node).paddingLeft),painted:!!document.elementFromPoint(x,y)?.closest('.dsov-effect')}
  })
  expect(gutter.offset).toBeGreaterThan(0)
  expect(gutter.offset).toBeLessThan(gutter.inset)
  expect(gutter.painted).toBe(true)
  await testInfo.attach(`left-gutter-${width}`,{body:await header.screenshot(),contentType:'image/png'})
  await row.evaluate(node => { node.scrollLeft = node.scrollWidth-node.clientWidth-12 })
  const endGutter=await row.evaluate(node => {
    const viewport=node.getBoundingClientRect(),cards=node.querySelectorAll('.dsov-effect'),card=cards[cards.length-1].getBoundingClientRect()
    return {offset:viewport.right-card.right,inset:parseFloat(getComputedStyle(node).paddingRight),painted:!!document.elementFromPoint(card.right-4,card.top+card.height/2)?.closest('.dsov-effect')}
  })
  expect(endGutter.offset).toBeGreaterThan(0)
  expect(endGutter.offset).toBeLessThan(endGutter.inset)
  expect(endGutter.painted).toBe(true)
  await testInfo.attach(`right-gutter-${width}`,{body:await header.screenshot(),contentType:'image/png'})
  await row.evaluate(node => { node.scrollLeft = 0 })
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
  await page.getByRole('button',{name:'Действия персонажа',exact:true}).click()
  await page.getByRole('menuitem',{name:'Добавить состояние',exact:true}).click()
  await expect(page.getByRole('dialog', { name: 'Эффекты и состояния', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect((await header.boundingBox()).height).toBeCloseTo(height, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(api.writes.length).toBe(writesBefore)
})
