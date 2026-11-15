import { expect } from '@playwright/test'
import { weaponSheetFixture } from './weapon-sheet.js'

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

export async function checkInventoryEmptySwipe(page, width, base = '', capture) {
  const api = await weaponSheetFixture(page)
  api.document().values.items = { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'packed', item_id: 201, count: 1 }] }] }
  await page.goto(base + '/char/test?tab=inventory', { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа', exact: true })
  const inventory = nav.getByRole('button', { name: 'Предметы', exact: true })
  await expect(inventory).toHaveAttribute('aria-current', 'page')
  const pager = page.locator('.mobile-swipe-stage')
  const client = await page.context().newCDPSession(page)
  const send = (type, point) => client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, radiusX: 1, radiusY: 1, force: 1, id: 1 }] : [] })
  const empty = page.locator('.mobile-swipe-pane:not([inert]) [data-sortable-container="sec_bag"] .inventory-bag-add')
  const cases = []
  try {
    const labels = await nav.getByRole('button').allTextContents()
    const index = labels.findIndex(label => label.trim() === 'Предметы')
    expect(index).toBeGreaterThan(0)
    for (const direction of [-1, 1]) {
      await inventory.tap()
      await expect(pager).not.toHaveClass(/dragging|settling/)
      const button = direction < 0 ? empty.last() : empty.first()
      await button.scrollIntoViewIfNeeded()
      const rect = await button.boundingBox(), start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      await send('touchStart', start)
      for (const progress of [.1, .25, .4]) { await send('touchMove', { x: start.x + direction * width * progress, y: start.y }); await frame(page) }
      await expect(pager).toHaveClass(/dragging/)
      if (capture) await capture(page, `drag-${direction}`)
      await send('touchEnd')
      const target = labels[(index - direction + labels.length) % labels.length].trim()
      await expect(nav.getByRole('button', { name: target, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(pager).not.toHaveClass(/dragging|settling/)
      await expect(page.getByRole('menu')).toHaveCount(0)
      cases.push({ direction, target })
    }
    await inventory.tap()
    await expect(pager).not.toHaveClass(/dragging|settling/)
    await empty.first().scrollIntoViewIfNeeded()
    const rect = await empty.first().boundingBox(), start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    await send('touchStart', start)
    for (const dy of [20, 50, 90]) { await send('touchMove', { x: start.x + 1, y: start.y + dy }); await frame(page) }
    await send('touchEnd')
    await expect(inventory).toHaveAttribute('aria-current', 'page')
    await expect(pager).not.toHaveClass(/dragging|settling/)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await empty.first().tap()
    const menu = page.getByRole('menu', { name: 'Добавить предмет', exact: true })
    await expect(menu.getByRole('menuitem', { name: 'Добавить из справочника', exact: true })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Добавить своё', exact: true })).toBeVisible()
    if (capture) await capture(page, 'tap-menu')
    await page.keyboard.press('Escape')
    await empty.first().focus(); await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    expect(api.writes).toEqual([])
    return { width, cases, verticalKeepsTab: true, noMenuAfterSwipe: true, tapOpensMenu: true, keyboardOpensMenu: true, noWrites: true }
  } finally { await client.detach() }
}
