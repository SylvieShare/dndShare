import { expect, test } from '@playwright/test'

function result(sides, rolls, bonus = 0) {
  const total = rolls.reduce((sum, value) => sum + value, 0) + bonus
  return { parts: [{ kind: 'dice', sides, rolls, sum: total - bonus },
    ...(bonus ? [{ kind: 'flat', sign: '+', value: bonus }] : [])], total, byType: [] }
}

async function prepare(page, mobile = false) {
  page.on('pageerror', error => { throw error })
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
  const requests = [], savedEvents = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/d20') || path.endsWith('/sequence')) { requests.push(route); return }
    if (path.endsWith('/save-targets')) return route.fulfill({ json: { targets: [
      { kind: 'character', charUuid: 'hero', name: 'Герой', snapshot: { values: { DEX: { value: 14 } } } },
    ] } })
    if (path.endsWith('/saves')) {
      const rows = route.request().postDataJSON().results
      savedEvents.push({ id: 1, sessionOwnerUserId: 1, data: { savingThrow: { ability: 2, dc: 15,
        results: rows.map(row => ({ ...row, key: `char:${row.target.charUuid}`, success: row.result.total >= 15 })) } } })
    }
    await route.fulfill({ json: path.endsWith('/events') ? { events: savedEvents } : {} })
  })
  await page.goto('/tests/tutorials/fixtures/dice-pending.html')
  return { requests, savedEvents }
}

for (const mobile of [false, true]) {
  test(`server dice start immediately and settle the same notification on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    const { requests } = await prepare(page, mobile)
    await page.getByRole('button', { name: 'Бросить атаку', exact: true }).click()
    const popup = page.locator('.dice-pop')
    await expect(popup).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.dice-pop-roll--pending')).toHaveCount(1)
    await expect.poll(() => requests.length).toBe(1)
    await page.evaluate(() => { window.originalDicePopup = document.querySelector('.dice-pop') })
    const face = popup.locator('.system-die__value'), initial = await face.textContent()
    const started = await page.evaluate(() => performance.now())
    await expect.poll(() => face.textContent()).not.toBe(initial)
    // Longer than the original 560 ms animation: it must still be spinning.
    await expect.poll(() => page.evaluate(() => performance.now())).toBeGreaterThan(started + 650)
    await expect(popup).toHaveAttribute('aria-busy', 'true')
    expect(await page.evaluate(() => window.published)).toEqual([])
    expect(await popup.locator('.dice-pop-roll--rolling').evaluate(el => el.getAnimations()[0].effect.getComputedTiming().iterations)).toBe(Infinity)
    await requests[0].fulfill({ json: { rolls: [20], karmic: false } })
    await expect(popup).toHaveAttribute('aria-busy', 'false')
    const settle = await popup.locator('.dice-pop-roll--rolling').evaluate(el => ({
      time: el.getAnimations()[0].currentTime,
      iterations: el.getAnimations()[0].effect.getComputedTiming().iterations,
    }))
    expect(settle.iterations).toBe(1)
    expect(settle.time).toBeLessThan(560)
    expect(await page.evaluate(() => window.originalDicePopup === document.querySelector('.dice-pop'))).toBe(true)
    await expect(popup.locator('.dice-pop-roll--rolling')).toHaveCount(0)
    await expect(face).toHaveText('20')
    await expect(popup).toContainText('КРИТ')
    expect(await page.evaluate(() => window.published.length)).toBe(1)
  })

  test(`embedded challenge and extra d20 wait in place on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    const { requests } = await prepare(page, mobile)
    await page.getByRole('button', { name: 'Начать испытание' }).click()
    const challenge = page.locator('.ecr-result')
    await expect(challenge).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.dice-pop')).toHaveCount(0)
    expect(await page.evaluate(() => window.pendingDiceFixture.encounter.value.challenge)).toBeUndefined()
    await expect.poll(() => requests.length).toBe(1)
    await requests[0].fulfill({ json: { rolls: [12] } })
    await expect(challenge).toHaveAttribute('aria-busy', 'false')
    await expect(challenge.locator('.ecr-die--rolling')).toHaveCount(0)
    await expect(challenge.locator('.ecr-total')).toHaveText('14')
    await challenge.getByRole('button', { name: 'Докинуть с преимуществом', exact: true }).click()
    await expect(challenge).toHaveAttribute('aria-busy', 'true')
    await expect(challenge.locator('.system-die__value').first()).toHaveText('12')
    await expect(challenge.locator('.ecr-die--rolling')).toHaveCount(1)
    await expect.poll(() => requests.length).toBe(2)
    await requests[1].fulfill({ json: { rolls: [20] } })
    await expect(challenge).toHaveAttribute('aria-busy', 'false')
    await expect(challenge.locator('.ecr-die--rolling')).toHaveCount(0)
    await expect(challenge.locator('.ecr-total')).toHaveText('22')
  })

  test(`saving throw and sequence show pending dice inside their target pickers on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    const { requests, savedEvents } = await prepare(page, mobile)
    await page.getByRole('button', { name: 'Бросить', exact: true }).click()
    let picker = page.getByRole('dialog')
    await picker.getByRole('checkbox', { name: 'Выбрать: Герой' }).check()
    await picker.getByRole('button', { name: 'Бросить · 1', exact: true }).click()
    await expect(picker.locator('.dice-roll-result[aria-busy="true"]')).toBeVisible()
    await expect.poll(() => requests.length).toBe(1)
    await requests[0].fulfill({ json: { rolls: [15] } })
    await expect(picker).toHaveCount(0)
    await expect(page.locator('.event-save-result .dice-roll-result')).toContainText('= 17')
    await expect(page.locator('.event-save-result .dice-roll-result-rolling')).toHaveCount(0)

    await page.getByRole('button', { name: 'Выбрать цель', exact: true }).click()
    picker = page.getByRole('dialog')
    await picker.getByRole('checkbox', { name: 'Выбрать: Герой' }).check()
    await picker.getByRole('button', { name: 'Выбрать и бросить атаку', exact: true }).click()
    await expect(picker.locator('.dice-roll-result[aria-busy="true"]')).toBeVisible()
    await expect.poll(() => requests.length).toBe(2)
    const event = { id: 2, sessionOwnerUserId: 1, data: { sequence: {
      attackBonus: 3, damageExpression: '2d6+3', criticalExpression: '4d6+3', revision: 1,
      hits: [{ status: 'attack', attack: result(20, [13], 3) }],
    } } }
    savedEvents.push(event)
    await requests[1].fulfill({ json: { event } })
    await expect(picker).toHaveCount(0)
    await expect(page.locator('.sequence-hit .dice-roll-result')).toContainText('= 16')
    await page.getByRole('button', { name: 'Попадание · бросить урон', exact: true }).click()
    await expect(page.locator('.sequence-hit .dice-roll-result[aria-busy="true"]')).toBeVisible()
    await expect.poll(() => requests.length).toBe(3)
    event.data.sequence.hits[0] = { ...event.data.sequence.hits[0], status: 'ready', result: result(6, [2, 5], 3) }
    await requests[2].fulfill({ json: { event } })
    await expect(page.locator('.sequence-hit .dice-roll-result[aria-busy="true"]')).toHaveCount(0)
    await expect(page.locator('.sequence-hit .dice-roll-result').last()).toContainText('= 10')
    await expect(page.locator('.sequence-hit .dice-roll-result-rolling')).toHaveCount(0)
  })
}

test('reduced motion waits without cycling, and errors or sheet changes remove pending dice', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { requests } = await prepare(page)
  const button = page.getByRole('button', { name: 'Бросить атаку', exact: true })
  await button.click()
  const popup = page.locator('.dice-pop')
  await expect(popup.locator('.system-die__value')).toHaveText('…')
  await expect(popup.locator('.dice-pop-roll--rolling')).toHaveCount(0)
  await expect.poll(() => requests.length).toBe(1)
  await requests[0].fulfill({ status: 403, json: { desc: 'Нет доступа' } })
  await expect(popup).toHaveCount(0)
  await expect(page.locator('[data-notification-type="error"]')).toContainText('Не удалось бросить d20')
  await button.click()
  await expect(popup).toHaveAttribute('aria-busy', 'true')
  await expect.poll(() => requests.length).toBe(2)
  await page.evaluate(() => { window.pendingDiceFixture.events.actorCharUuid = 'other' })
  await requests[1].fulfill({ json: { rolls: [20] } })
  await expect(popup).toHaveCount(0)
  expect(await page.evaluate(() => window.published)).toEqual([])
})
