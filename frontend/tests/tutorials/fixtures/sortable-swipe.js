import { expect } from '@playwright/test'
import { weaponSheetFixture } from './weapon-sheet.js'

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

export async function checkSortableSwipe(page, width, rootUrl = '') {
  const api = await weaponSheetFixture(page)
  api.document().values.weapon.push({ uid: 'second', item_id: 201 })
  api.document().values.items = { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'packed', item_id: 201, count: 1 }] }] }
  await page.goto(rootUrl + '/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const nav = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа', exact: true })
  const pager = page.locator('.mobile-swipe-stage')
  const track = page.locator('.mobile-swipe-track')
  const client = await page.context().newCDPSession(page)
  const send = (type, point) => client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, radiusX: 1, radiusY: 1, force: 1, id: 1 }] : [] })
  const cases = []
  try {
    for (const [tab, selector, release, next] of [
      ['Оружие', '.mobile-swipe-pane:not([inert]) .w-name', 'touchEnd', 'Магия'],
      ['Предметы', '[data-sortable-container="sec_bag"] .inventory-bag-item', 'touchCancel', 'Способности'],
    ]) {
      await nav.getByRole('button', { name: tab, exact: true }).click()
      await expect(pager).not.toHaveClass(/dragging|settling/)
      const handle = page.locator(selector).first()
      await expect(handle).toBeVisible()
      await handle.scrollIntoViewIfNeeded()
      const before = structuredClone(api.writes)
      const transform = await track.getAttribute('style')
      const box = await handle.boundingBox()
      const start = { x: box.x + Math.min(40, box.width / 2), y: box.y + box.height / 2 }
      await send('touchStart', start)
      for (const dx of [8, 40, 80]) { await send('touchMove', { x: start.x + dx, y: start.y }); await frame(page) }
      await expect(page.locator('body')).toHaveClass(/sortable-dragging/)
      await expect(page.locator('.sortable-ghost')).toHaveCount(1)
      await expect(pager).not.toHaveClass(/dragging|settling/)
      await expect(nav.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
      expect(await track.getAttribute('style')).toBe(transform)
      await send(release)
      await expect(page.locator('.sortable-ghost')).toHaveCount(0)
      await expect(page.locator('body')).not.toHaveClass(/sortable-dragging/)
      await expect(pager).not.toHaveClass(/dragging|settling/)
      await expect(nav.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
      expect(api.writes).toEqual(before)
      const point = await page.locator('.mobile-swipe-pane:not([inert])').evaluate(pane => {
        const rect = pane.getBoundingClientRect(), x = rect.x + rect.width * .8
        for (let y = innerHeight - 100; y > 220; y -= 24) {
          const target = document.elementFromPoint(x, y)
          if (pane.contains(target) && !target.closest('button,input,textarea,select,[contenteditable="true"],[data-sortable-key],.share-icon-navigation')) return { x, y }
        }
        throw new Error('No free surface for the next normal swipe')
      })
      await send('touchStart', point)
      for (const fraction of [.1, .25, .4]) { await send('touchMove', { x: point.x - width * fraction, y: point.y }); await frame(page) }
      await send('touchEnd')
      await expect(nav.getByRole('button', { name: next, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(pager).not.toHaveClass(/dragging|settling/)
      await expect(page.getByRole('menu')).toHaveCount(0)
      cases.push({ tab, release, draggingMoved: true, pagerStayed: true, noDragWrites: true, followingSwipe: next })
    }
  } finally { await client.detach() }
  return { width, cases }
}
