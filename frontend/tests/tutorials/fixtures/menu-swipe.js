import { expect } from '@playwright/test'
import { weaponSheetFixture } from './weapon-sheet.js'

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

export async function checkMenuSwipe(page, width, base = '', capture) {
  const api = await weaponSheetFixture(page)
  api.catalogue[701] = { id: 701, typeId: 14, name: 'Инструмент для проверки', data: {} }
  api.document().values.items = { equipped: [], sections: [{ id: 'bag', name: 'Рюкзак', items: [{ uid: 'tool', item_id: 701, count: 1 }] }] }
  await page.goto(base + '/char/test?tab=weapons', { waitUntil: 'networkidle' })
  const nav = page.locator('[data-sheet-navigation]'), pager = page.locator('.mobile-swipe-stage')
  const selected = () => nav.locator('[aria-current="page"]')
  const client = await page.context().newCDPSession(page)
  async function swipeOutsideMenu() {
    // Find actual sheet background outside the teleported menus, with room for a left swipe.
    const start = await page.locator('.mobile-swipe-pane:not([inert])').evaluate(pane => {
      for (let y = innerHeight - 100; y > 210; y -= 24) for (const fraction of [.85, .7, .55]) {
        const x = innerWidth * fraction, node = document.elementFromPoint(x, y)
        if (pane.contains(node) && !node.closest('button,input,textarea,select,[contenteditable="true"],[data-sortable-key]')) return { x, y }
      }
      throw new Error('No sheet background outside menus')
    })
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (const progress of [.12, .25, .4]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - width * progress, y: start.y }] })
      await frame(page)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await frame(page)
  }
  const cases = [
    ['Оружие', async () => { await page.locator('.w-card:visible .w-name').first().tap() }],
    ['Статы', async () => { await page.getByRole('button', { name: 'Ловкость — проверка', exact: true }).tap() }],
    ['Предметы', async () => {
      await page.getByText('Инструмент для проверки', { exact: true }).tap()
      await page.getByRole('menuitem', { name: 'Бросок', exact: true }).tap()
      await expect(page.getByRole('menuitem', { name: /^Сила/ })).toBeVisible()
    }],
  ]
  const checked = []
  try {
    for (const [label, open] of cases) {
      await nav.getByRole('button', { name: label, exact: true }).tap()
      await expect(selected()).toHaveText(label)
      await expect(pager).not.toHaveClass(/dragging|settling/)
      await open()
      await expect(page.getByRole('menu').first()).toBeVisible()
      if (capture) await capture(page, label)
      const before = await page.locator('.mobile-swipe-track').getAttribute('style')
      await swipeOutsideMenu()
      await expect(selected()).toHaveText(label)
      await expect(pager).not.toHaveClass(/dragging|settling/)
      expect(await page.locator('.mobile-swipe-track').getAttribute('style')).toBe(before)
      // Closing the menu must not keep the next independent touch locked.
      for (let index = 0; index < 3 && await page.getByRole('menu').count(); index++) await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await swipeOutsideMenu()
      await expect(selected()).not.toHaveText(label)
      await expect(pager).not.toHaveClass(/dragging|settling/)
      checked.push(label)
    }
    expect(api.writes).toEqual([])
    return { width, checked, blockedDismissalGesture: true, nextSwipeWorks: true, noWrites: true }
  } finally { await client.detach() }
}
