import { test, expect } from '@playwright/test'
const url = '/tests/weapon-charges/weapon-panels.html'

for (const width of [1280, 390]) {
  test(`weapon mechanics animate both ways and reverse without jumping (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(url)
    const details = page.getByTestId('javelin').locator('details')
    const summary = details.locator('summary')
    await expect(details).toHaveJSProperty('open', false)
    const closedHeight = await details.evaluate(element => element.getBoundingClientRect().height)
    const opening = await details.evaluate(async element => {
      element.querySelector('summary').click()
      const animation = element.getAnimations()[0]
      animation.pause()
      animation.currentTime = 80
      await new Promise(requestAnimationFrame)
      return { height: element.getBoundingClientRect().height, fullHeight: element.scrollHeight }
    })
    expect(opening.height).toBeGreaterThan(closedHeight + 2)
    expect(opening.height).toBeLessThan(opening.fullHeight - 2)
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    const reversal = await details.evaluate(async element => {
      const before = element.getBoundingClientRect().height
      element.querySelector('summary').click()
      const animation = element.getAnimations()[0]
      animation.pause()
      animation.currentTime = 0
      await new Promise(requestAnimationFrame)
      const start = element.getBoundingClientRect().height
      animation.currentTime = 110
      await new Promise(requestAnimationFrame)
      const middle = element.getBoundingClientRect().height
      animation.finish()
      return { before, start, middle }
    })
    expect(Math.abs(reversal.start - reversal.before)).toBeLessThan(1)
    expect(reversal.middle).toBeGreaterThan(closedHeight)
    expect(reversal.middle).toBeLessThan(reversal.before)
    await expect(details).toHaveJSProperty('open', false)
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(() => details.evaluate(element => element.getAnimations().length)).toBe(0)
    const openHeight = await details.evaluate(element => element.getBoundingClientRect().height)
    expect(openHeight).toBeGreaterThan(closedHeight + 2)
    await expect(details).not.toHaveAttribute('style', /height/)
    await page.keyboard.press('Space')
    await expect(details).toHaveJSProperty('open', false)
    await expect.poll(() => details.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(closedHeight, 0)
    await expect(page.getByTestId('javelin').getByRole('group', { name: /из/ })).toHaveAttribute('aria-label', /1 из 1/)
  })
}

test('reduced motion toggles immediately and charge controls do not toggle the disclosure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(url)
  const mace = page.getByTestId('mace')
  const details = mace.locator('details')
  const summary = details.locator('summary')
  await mace.getByRole('button', { name: 'Заряд 3', exact: true }).click()
  await expect(details).toHaveJSProperty('open', false)
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveJSProperty('open', true)
  expect(await details.evaluate(element => element.getAnimations().length)).toBe(0)
  await mace.getByRole('button', { name: 'Заряд 3', exact: true }).click()
  await expect(details).toHaveJSProperty('open', true)
  await summary.focus()
  await page.keyboard.press('Space')
  await expect(details).toHaveJSProperty('open', false)
  expect(await details.evaluate(element => element.getAnimations().length)).toBe(0)
  await expect(mace.locator('.item-mechanic-chevron')).toHaveCSS('transition-duration', '0s')
})
