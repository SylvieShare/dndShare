import { test, expect } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`two players chat and resolve a hidden-choice round (${mobile ? 'mobile' : 'desktop'})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 850 } })
    const events = [], read = new Set(), requests = []
    let choice, failNext = false
    await context.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request(), url = new URL(req.url()), body = req.postDataJSON(), match = url.pathname.match(/\/char\/([ab])\/interactions/)
      if (!match) return route.fulfill({ json: { events: [], items: [] } })
      const own = match[1]
      if (req.method() === 'GET') {
        const peer = url.searchParams.get('peer')
        const visible = peer ? events : events.filter(event => event.type === 'rps_challenge' ? event.data.status === 'pending' : event.data.recipientCharUuid === own && !read.has(event.id))
        return route.fulfill({ json: { events: [...visible].reverse(), hasMore: false } })
      }
      if (url.pathname.endsWith('/read')) {
        events.filter(event => event.data.recipientCharUuid === own && event.id <= body.throughId).forEach(event => read.add(event.id))
        return route.fulfill({ json: { ok: true } })
      }
      if (url.pathname.endsWith('/resolve')) {
        const event = events.find(event => event.id === Number(url.pathname.split('/').at(-2)))
        if (body.decision === 'cancel' || body.decision === 'decline') event.data.status = body.decision === 'cancel' ? 'cancelled' : 'declined'
        else Object.assign(event.data, { status: 'completed', senderChoice: choice, recipientChoice: body.decision, winnerCharUuid: choice === body.decision ? null : 'b', resolvedByUserId: 2 })
        return route.fulfill({ json: { event } })
      }
      requests.push(body)
      if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { desc: 'Временная ошибка' } }) }
      const existing = events.find(event => event.clientActionId === body.clientActionId)
      if (existing) return route.fulfill({ json: { event: existing } })
      const peer = own === 'a' ? 'b' : 'a'
      const event = { id: events.length + 1, authorUserId: own === 'a' ? 1 : 2, recipientUserId: own === 'a' ? 2 : 1, sessionOwnerUserId: 3,
        actorCharUuid: own, actorImageUrl: '/brand-mark.webp', recipientImageUrl: '/brand-mark.webp', type: body.type, clientActionId: body.clientActionId, action: body.type === 'chat_message' ? 'Сообщение' : 'Камень / ножницы / бумага', createdAt: new Date().toISOString(),
        data: { senderCharUuid: own, recipientCharUuid: peer, senderName: own === 'a' ? 'Лиора' : 'Торин', recipientName: own === 'a' ? 'Торин' : 'Лиора' } }
      if (body.type === 'chat_message') event.data.message = body.message
      else { choice = body.choice; event.data.status = 'pending' }
      events.push(event)
      return route.fulfill({ json: { event } })
    })
    const a = await context.newPage(), b = await context.newPage()
    for (const page of [a, b]) page.on('pageerror', error => { throw error })
    await a.goto('/tests/interactions/fixture.html?own=a')
    await b.goto('/tests/interactions/fixture.html?own=b')
    await a.getByRole('button', { name: 'Игроки', exact: true }).click()
    const player = a.getByRole('button', { name: 'Действия: Торин' })
    await player.focus(); await a.keyboard.press('Enter')
    await a.getByRole('menuitem', { name: 'Чат', exact: true }).click()
    const dialogA = a.getByRole('dialog', { name: 'Чат — Торин', exact: true })
    await expect(dialogA).toBeVisible()
    failNext = true
    await a.getByRole('textbox', { name: 'Сообщение', exact: true }).fill('Привет <script>alert(1)</script>')
    await a.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(a.getByRole('alert')).toHaveText('Временная ошибка')
    await expect(a.getByRole('textbox', { name: 'Сообщение', exact: true })).toHaveValue('Привет <script>alert(1)</script>')
    await a.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(a.getByRole('log')).toContainText('Привет <script>alert(1)</script>')
    expect(requests[0].clientActionId).toBe(requests[1].clientActionId)
    await b.evaluate(() => window.fixture.refresh())
    await expect(b.locator('.campaign-icon--notify')).toHaveCount(1)
    await expect(b.locator('.campaign-icon--notify .campaign-symbol')).toHaveCSS('animation-name', /campaign-notification-pulse/)
    await b.emulateMedia({ reducedMotion: 'reduce' })
    await expect(b.locator('.campaign-icon--notify .campaign-symbol')).toHaveCSS('animation-name', 'none')
    await b.emulateMedia({ reducedMotion: 'no-preference' })
    await b.getByRole('button', { name: 'События', exact: true }).click()
    await b.getByRole('button', { name: 'Открыть чат', exact: true }).click()
    await expect(b.getByRole('log')).toContainText('Привет <script>alert(1)</script>')
    await expect(b.locator('.campaign-icon--notify')).toHaveCount(0)
    await expect(b.locator('.chat-heading img')).toHaveCount(1)
    await expect(b.locator('.interaction-entry-body')).not.toContainText('Лиора')
    await expect(b.locator('.interaction-avatar img')).toHaveCount(1)
    await b.getByRole('textbox', { name: 'Сообщение', exact: true }).fill('Привет!')
    await b.getByRole('button', { name: 'Отправить', exact: true }).click()
    await a.evaluate(() => window.fixture.refresh())
    await expect(a.getByRole('log')).toContainText('Привет!')
    async function openPeer(page, name, mode) {
      const modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Закрыть', exact: true }) })
      if (await modal.count()) await modal.getByRole('button', { name: 'Закрыть', exact: true }).click()
      await page.getByRole('button', { name: 'Игроки', exact: true }).click()
      await page.getByRole('button', { name: `Действия: ${name}` }).click()
      await page.getByRole('menuitem', { name: mode, exact: true }).click()
    }
    await openPeer(a, 'Торин', 'Камень / ножницы / бумага')
    const gameA = a.getByRole('dialog', { name: 'Камень / ножницы / бумага — Торин', exact: true })
    await expect(gameA.getByRole('radio')).toHaveCount(0)
    await expect(gameA.getByRole('textbox')).toHaveCount(0)
    await expect(gameA.getByRole('button', { name: 'Камень', exact: true }).locator('svg')).toBeVisible()
    await a.getByRole('button', { name: 'Камень', exact: true }).click()
    await expect(gameA).toContainText('Ваш выбор сохранён')
    await expect(a.locator('.campaign-icon--notify')).toHaveCount(0)
    await b.evaluate(() => window.fixture.refresh())
    await expect(b.locator('.campaign-icon--notify')).toHaveCount(1)
    await openPeer(b, 'Лиора', 'Камень / ножницы / бумага')
    const gameB = b.getByRole('dialog', { name: 'Камень / ножницы / бумага — Лиора', exact: true })
    await expect(gameB).toContainText('Вас вызывают')
    const pending = await b.evaluate(() => window.fixture.controller.interactions.currentRound)
    expect(pending.data.senderChoice).toBeUndefined()
    await expect(gameB.locator('.rps-result')).toHaveCount(0)
    await b.getByRole('button', { name: 'Бумага', exact: true }).click()
    await expect(gameB.locator('.rps-contestant--winner')).toContainText('Торин')
    await expect(b.locator('.campaign-icon--notify')).toHaveCount(0)
    await a.evaluate(() => window.fixture.refresh())
    await expect(gameA.locator('.rps-result')).toHaveAttribute('aria-label', 'Лиора: Камень · Торин: Бумага · Победитель: Торин')
    await expect(gameA.locator('.rps-versus')).toHaveText('VS')
    await expect(gameA.getByRole('button', { name: 'Ещё раз', exact: true })).toBeVisible()
    await openPeer(a, 'Торин', 'Чат')
    await expect(a.getByRole('log').locator('.rps-result--compact')).toHaveCount(1)
    await expect(a.getByRole('log').locator('.rps-contestant--winner')).toContainText('Торин')
    await a.reload()
    await openPeer(a, 'Торин', 'Камень / ножницы / бумага')
    await expect(gameA.locator('.rps-contestant--winner')).toContainText('Торин')
    await a.getByRole('button', { name: 'Ещё раз', exact: true }).click()
    await a.getByRole('button', { name: 'Ножницы', exact: true }).click()
    await b.evaluate(() => window.fixture.refresh())
    await b.getByRole('button', { name: 'Ножницы', exact: true }).click()
    await expect(gameB).toContainText('Ничья')
    await expect(gameB.locator('.rps-contestant--winner')).toHaveCount(0)
    await a.evaluate(() => window.fixture.refresh())
    await a.getByRole('button', { name: 'Ещё раз', exact: true }).click()
    await a.getByRole('button', { name: 'Камень', exact: true }).click()
    await a.getByRole('button', { name: 'Отозвать вызов', exact: true }).click()
    await expect(gameA).toContainText('Вызов отозван')
    await a.getByRole('button', { name: 'Ещё раз', exact: true }).click()
    await a.getByRole('button', { name: 'Бумага', exact: true }).click()
    await b.evaluate(() => window.fixture.refresh())
    await b.getByRole('button', { name: 'Отклонить вызов', exact: true }).click()
    await expect(gameB).toContainText('Вызов отклонён')
    await expect(gameB.locator('.rps-result')).toHaveCount(0)
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await context.close()
  })
}
