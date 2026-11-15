import { expect } from '@playwright/test'
import { weaponSheetFixture } from './weapon-sheet.js'

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

export async function prepareSkillDescriptions(page, base = '', owner = true) {
  const api = await weaponSheetFixture(page, owner)
  api.suggests[15] = [
    { id: 130, typeId: 15, value: 'История', desc: '<p>История помогает вспомнить сведения о <strong>древних цивилизациях</strong>.</p>' },
    { id: 131, typeId: 15, value: 'Магия', desc: '<p>Магия объясняет заклинания и магические традиции.</p>' },
    { id: 132, typeId: 15, value: 'Природа', desc: '<p>Природа описывает растения и животных.</p>' },
  ]
  api.document().values.INT.skills = { 130: { up: 1, override_title: 'История' }, 131: { up: 2, override_title: 'Магия' }, 132: { up: 0, override_title: 'Природа' } }
  api.document().values.INT.save_up = true
  await page.goto(base + '/char/test?tab=stats', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: 'Описание навыка История', exact: true })).toBeVisible()
  return api
}

export async function checkSkillDescriptions(page, width, base = '', capture) {
  const api = await prepareSkillDescriptions(page, base)
  const history = page.getByRole('button', { name: 'Описание навыка История', exact: true })
  const magic = page.getByRole('button', { name: 'Описание навыка Магия', exact: true })
  const nature = page.getByRole('button', { name: 'Описание навыка Природа', exact: true })
  await expect(history.locator('.lucide-circle-check')).toHaveCount(1)
  await expect(magic.locator('.lucide-gem')).toHaveCount(1)
  await expect(nature.locator('.proficiency-icon')).toHaveCount(0)
  await expect(page.locator('.save-number .lucide-circle-check')).toHaveCount(1)
  await expect(page.locator('.proficiency-dot')).toHaveCount(0)
  const box = await history.boundingBox(), text = await history.locator('.skill-name').boundingBox()
  expect(box.width).toBeGreaterThan(text.width + 4)
  await history.tap({ position: { x: 1, y: box.height / 2 } })
  const popup = page.getByRole('dialog', { name: 'История', exact: true })
  await expect(popup).toContainText('древних цивилизациях')
  await expect(popup).toContainText('Владение')
  await expect(popup).toContainText('Итого')
  await expect(history).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const bounds = await popup.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
  expect(await popup.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  if (capture) await capture(page, 'description')
  await history.tap(); await expect(popup).toHaveCount(0)
  await history.tap(); await page.touchscreen.tap(4, 4); await expect(popup).toHaveCount(0)
  await history.focus(); await history.press('Enter'); await expect(popup).toBeVisible()
  await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0)
  await history.press('Space'); await expect(popup).toBeVisible()
  await magic.tap()
  const magicPopup = page.getByRole('dialog', { name: 'Магия', exact: true })
  await expect(popup).toHaveCount(0); await expect(magicPopup).toContainText('магические традиции')
  await page.getByRole('button', { name: 'Магия — проверка', exact: true }).tap()
  await expect(magicPopup).toHaveCount(0)
  await expect(page.getByRole('menu', { name: 'Магия', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await history.tap()
  const rect = await history.boundingBox(), start = { x: rect.x + Math.min(40, rect.width / 2), y: rect.y + rect.height / 2 }
  const client = await page.context().newCDPSession(page)
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (const progress of [.1, .25, .4]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + width * progress, y: start.y }] })
      await frame(page)
    }
    await expect(popup).toHaveCount(0)
    await expect(page.locator('.mobile-swipe-stage')).toHaveClass(/dragging/)
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const nav = page.getByRole('navigation', { name: width < 600 ? 'Вкладки персонажа' : 'Раздел персонажа', exact: true })
    const last = nav.getByRole('button').last()
    await expect(last).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.mobile-swipe-stage')).not.toHaveClass(/dragging|settling/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } finally { await client.detach() }
  expect(api.writes).toEqual([])
  return { width, paddingTap: true, descriptionAndBonuses: true, sameRankIcons: true, repeatAndOutsideClose: true, keyboardAndEscape: true, numericBonusKeepsRollMenu: true, swipeDismissesAndNavigates: true, noWrites: true }
}
