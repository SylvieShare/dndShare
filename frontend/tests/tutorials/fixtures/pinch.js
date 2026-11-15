export const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
export async function pinch(page, target, factor = 1.7, position) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  const center = position || { x: box.x + box.width * .6, y: box.y + box.height * .6 }
  const half = Math.min(35, box.width / 8)
  const client = await page.context().newCDPSession(page)
  const points = ratio => [{ id: 1, x: center.x - half * ratio, y: center.y }, { id: 2, x: center.x + half * ratio, y: center.y }]
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(1).slice(0, 1) })
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(1) })
    for (const progress of [.25, .6, 1]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(1 + (factor - 1) * progress) })
      await frame(page)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await frame(page)
  } finally { await client.detach() }
}
export async function wheelOut(page, target) {
  const box = await target.boundingBox()
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6)
  await page.mouse.wheel(0, 120); await frame(page)
}
export const scale = locator => locator.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).a)
