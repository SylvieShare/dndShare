import { test, expect } from '@playwright/test'

async function pixelContrast(page, image) {
  return page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    let contrast = 0
    for (let y = 0; y < bitmap.height; y++) for (let x = 1; x < bitmap.width; x++) {
      const index = (y * bitmap.width + x) * 4
      contrast += Math.abs(data[index] - data[index - 4])
    }
    return contrast / ((bitmap.width - 1) * bitmap.height)
  }, image.toString('base64'))
}

test('story tools blur a chapter image behind the panel', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    window.EventSource = class { constructor() { setTimeout(() => this.onopen?.(), 0) } addEventListener() {} removeEventListener() {} close() {} }
  })
  await page.route('**/chapter-stripes.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="236" height="156"><defs><pattern id="stripes" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="8" fill="white"/><rect x="4" width="4" height="8" fill="black"/></pattern></defs><rect width="236" height="156" fill="url(#stripes)"/></svg>' }))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/user/checkAuth') json = { auth: true, user: { id: 1, roles: [], login: 'Мастер' } }
    else if (path === '/api/sessions/test') json = { session: { uuid: 'test', name: 'История', ownerUserId: 1, systemId: 1, status: 'stopped' }, participants: [], myRole: 'gm' }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path.endsWith('/chapter-graph')) json = { arcs: [{ id: 1, order: 1, name: 'Путь' }], chapters: [{ id: 11, arcId: 1, number: '1', name: 'Перевал', status: 'planned', imageUrl: '/chapter-stripes.svg', positionX: 100, positionY: 100 }, { id: 12, arcId: 1, number: '2', name: 'Начало', positionX: 0, positionY: 400 }], edges: [] }
    else if (path.endsWith('/encounter')) json = { active: false, round: 0, turnIndex: 0, combatants: [] }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/account/tutorials') json = { tutorials: [{ flowId: 'session-dm', sourceKey: 'source:1', device: 'desktop', status: 'completed', revision: 1 }] }
    await route.fulfill({ json })
  })
  await page.goto('/sessions/test')
  const card = page.locator('.nested-graph-node[data-graph-node-id="11"]')
  await expect(card).toBeVisible()
  await expect(card.locator('img')).toBeVisible()
  await card.locator('img').evaluate(image => image.decode())
  const tools = page.locator('[data-tutorial="session-tools"]')
  const rail = await tools.boundingBox(), before = await card.boundingBox()
  const target = { x: rail.x - 70, y: rail.y + 70 }
  await page.mouse.move(before.x + 30, before.y + 50)
  await page.mouse.down()
  await page.mouse.move(target.x + 30, target.y + 50, { steps: 12 })
  await expect.poll(async () => Math.abs((await card.boundingBox()).x - target.x)).toBeLessThan(2)
  await page.mouse.up()
  await expect.poll(async () => Math.abs((await card.boundingBox()).x - target.x)).toBeLessThan(2)
  await tools.evaluate(async element => {
    // Hide controls only for the pixel comparison; the real chapter and panel stay mounted.
    await Promise.all(element.getAnimations().map(animation => animation.finished))
    for (const child of element.children) child.style.visibility = 'hidden'
  })
  const image = await card.boundingBox()
  const clip = { x: rail.x + 18, y: image.y + 18, width: 46, height: 24 }
  const blurred = await pixelContrast(page, await page.screenshot({ clip }))
  await tools.evaluate(element => { element.style.backdropFilter = 'none'; element.style.webkitBackdropFilter = 'none' })
  const sharp = await pixelContrast(page, await page.screenshot({ clip }))
  expect(sharp).toBeGreaterThan(5)
  expect(blurred).toBeLessThan(sharp * .2)
})
