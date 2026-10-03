import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

async function mockMeetings(page, role, initial = [], failCreate = false) {
  let occurrences = initial.map(row => ({ ...row, sectionId: row.id + 100, entryCount: 0, changedAt: '2026-10-03T10:00:00Z' }))
  const entries = new Map(initial.map(row => [row.id + 100, row.entries || []]))
  const writes = []
  function diary() {
    return {
      journal: { uuid: 'journal', kind: 'session', sessionUuid: 'test', name: 'Дневник кампании', playersCanEdit: false,
        sections: occurrences.map(row => ({ id: row.sectionId, occurrenceId: row.id, number: row.number, title: row.name, date: row.date || '', events: entries.get(row.sectionId) || [] })) },
      canEdit: role === 'dm', canManage: role === 'dm',
    }
  }
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = req.method()
    if (method !== 'GET') {
      const body = req.postData() ? req.postDataJSON() : null
      writes.push({ path, method, body })
      if (path.endsWith('/occurrences') && method === 'POST') {
        if (failCreate) { failCreate = false; return route.fulfill({ status: 409, json: { desc: 'Номер уже занят' } }) }
        occurrences.push({ ...body, id: 20, sectionId: 120, entryCount: 0, changedAt: '2026-10-03T11:00:00Z' })
      } else if (/\/occurrences\/\d+$/.test(path)) {
        const id = Number(path.split('/').at(-1))
        if (method === 'DELETE') occurrences = occurrences.filter(row => row.id !== id)
        else occurrences = occurrences.map(row => row.id === id ? { ...row, ...body } : row)
      } else if (/\/sections\/\d+\/entries$/.test(path)) {
        const sectionId = Number(path.split('/').at(-2))
        entries.set(sectionId, [...(entries.get(sectionId) || []), { ...body, id: 700, changedAt: '2026-10-03T11:00:00Z' }])
        return route.fulfill({ json: diary() })
      } else if (/\/journals\/journal\/entries\/\d+$/.test(path)) {
        const id = Number(path.split('/').at(-1))
        for (const [sectionId, rows] of entries) entries.set(sectionId, rows.map(row => row.id === id ? { ...row, ...body } : row))
        return route.fulfill({ json: diary() })
      }
      return route.fulfill({ json: { occurrences } })
    }
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: ['desktop', 'mobile'].map(device => ({ flowId: `session-${role}`, sourceKey: 'source:1', device, revision: TUTORIAL_REVISION, status: 'completed' })) }
    if (path === '/api/sessions/test') json = { session: { uuid: 'test', name: 'Приключение', systemId: 1, ownerUserId: role === 'dm' ? 1 : 2, status: 'stopped' }, participants: [], myRole: role === 'dm' ? 'gm' : 'player' }
    if (path === '/api/sessions/test/occurrences') json = { occurrences }
    if (path === '/api/sessions/test/journal') json = diary()
    await route.fulfill({ json })
  })
  return writes
}
async function chooseMeeting(page, mobile, number, name) {
  if (mobile) {
    await page.getByRole('combobox', { name: 'Выбрать сессию', exact: true }).click()
    await page.getByRole('option', { name: new RegExp(`^#${number} · ${name} ·`) }).click()
  } else await page.getByRole('button', { name: `Сессия #${number}: ${name}`, exact: true }).click()
}
test.beforeEach(({ page }) => { page.on('pageerror', error => { throw error }) })

for (const mobile of [false, true]) {
  test(`calendar creates a meeting and reveals its diary in place (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 })
    const writes = await mockMeetings(page, 'dm', [], true)
    // Old links now resolve to the one combined diary.
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test%3Fview=schedule')
    await expect(page.getByRole('button', { name: 'Сессии', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Новая сессия', exact: true }).click()
    await page.getByRole('textbox', { name: 'Название сессии', exact: true }).fill('Тайна крепости')
    await page.getByRole('button', { name: 'Дата сессии', exact: true }).click()
    const calendar = page.getByRole('dialog', { name: 'Дата сессии', exact: true })
    await expect(calendar).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(calendar).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Название сессии', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Дата сессии', exact: true }).click()
    await calendar.getByLabel('Год', { exact: true }).selectOption('2089')
    await calendar.getByLabel('Месяц', { exact: true }).selectOption('10')
    await calendar.locator('[data-date="2089-11-12"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(calendar.locator('[data-date="2089-11-13"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(calendar.getByRole('button', { name: 'Сегодня', exact: true })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Номер уже занят')
    await expect(page.getByRole('textbox', { name: 'Название сессии', exact: true })).toHaveValue('Тайна крепости')
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Тайна крепости', exact: true })).toBeVisible()
    expect(writes.map(write => write.body)).toEqual([{ number: 1, name: 'Тайна крепости', date: '2089-11-13' }, { number: 1, name: 'Тайна крепости', date: '2089-11-13' }])
    await expect(page.locator('.session-journal__meeting')).toContainText('13 ноября 2089')
    await expect(page.getByRole('button', { name: 'Добавить запись', exact: true })).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Дневник сессии/ })).toHaveCount(0)
  })
  test(`player sees only the meeting list beside chapter and party (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 })
    const writes = await mockMeetings(page, 'player', [
      { id: 4, number: 4, name: 'Пролог', date: '1999-01-01' },
      { id: 1, number: 1, name: 'Первая игра', date: '2000-01-01', entries: [{ id: 501, type: 'event', title: 'Старая запись', desc: '', payload: {} }] },
      { id: 3, number: 3, name: 'Позже', date: '2090-02-01' },
      { id: 2, number: 2, name: 'Ближайшая', date: '2090-01-01' },
    ])
    const diaryRequests = []
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/sessions/test/journal') diaryRequests.push(request.url()) })
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test')
    const list = page.getByRole('list', { name: 'Сессии кампании', exact: true })
    await expect(list.getByRole('listitem')).toHaveCount(4)
    expect(await list.getByRole('listitem').locator('strong').allTextContents()).toEqual(['Пролог', 'Первая игра', 'Ближайшая', 'Позже'])
    await expect(page.getByRole('region', { name: 'Следующая', exact: true })).toContainText('Ближайшая')
    await expect(page.getByRole('region', { name: 'Будущие', exact: true })).toContainText('Позже')
    await expect(page.getByRole('region', { name: 'Прошедшие', exact: true })).toContainText('Первая игра')
    await expect(list.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Выбрать сессию', exact: true })).toHaveCount(0)
    await expect(page.locator('.session-journal, .diary-section')).toHaveCount(0)
    await expect(page.getByText('Старая запись', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Новая сессия', exact: true })).toHaveCount(0)
    const layout = await page.locator('.player-session__grid').evaluate(el => [...el.children].map(child => {
      const rect = child.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width }
    }))
    expect(layout).toHaveLength(3)
    if (mobile) {
      expect(layout[1].y).toBeGreaterThan(layout[0].y)
      expect(layout[2].y).toBeGreaterThan(layout[1].y)
    } else {
      expect(layout[1].y).toBeCloseTo(layout[0].y, 0)
      expect(layout[2].y).toBeCloseTo(layout[0].y, 0)
      expect(layout[0].x).toBeLessThan(layout[1].x)
      expect(layout[1].x).toBeLessThan(layout[2].x)
    }
    expect(diaryRequests).toEqual([])
    expect(writes).toEqual([])
  })
  test(`master edits and deletes the selected session (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 })
    const writes = await mockMeetings(page, 'dm', [
      { id: 1, number: 1, name: 'Сохранить соседнюю', date: '2090-01-01' },
      { id: 2, number: 2, name: 'До правки', date: '2090-02-01' },
    ])
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test%3Fview=journal')
    await chooseMeeting(page, mobile, 2, 'До правки')
    await page.getByRole('button', { name: 'Действия с сессией #2', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Редактировать сессию', exact: true }).click()
    await page.getByRole('textbox', { name: 'Название сессии', exact: true }).fill('После правки')
    await page.getByRole('spinbutton', { name: 'Номер сессии', exact: true }).fill('5')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    expect(writes[0]).toEqual({ path: '/api/sessions/test/occurrences/2', method: 'PATCH', body: { number: 5, name: 'После правки', date: '2090-02-01', expectedChangedAt: '2026-10-03T10:00:00Z' } })
    await expect(page.getByRole('heading', { name: 'После правки', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Действия с сессией #5', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Удалить сессию', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Удалить сессию?', exact: true })).toContainText('все записи её дневника')
    await page.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(writes).toHaveLength(1)
    await page.getByRole('button', { name: 'Действия с сессией #5', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Удалить сессию', exact: true }).click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'После правки', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Сохранить соседнюю', exact: true })).toBeVisible()
    expect(writes[1]).toEqual({ path: '/api/sessions/test/occurrences/2', method: 'DELETE', body: null })
  })
  test(`entry drafts lock session selection and stay in the right diary (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 })
    const writes = await mockMeetings(page, 'dm', [
      { id: 1, number: 1, name: 'Первая', date: '2000-01-01' },
      { id: 2, number: 2, name: 'Вторая', date: '2090-01-01' },
    ])
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test%3Fview=journal')
    await page.getByRole('button', { name: 'Добавить запись', exact: true }).click()
    await page.getByRole('button', { name: 'Событие', exact: true }).click()
    await page.getByRole('textbox', { name: 'Название записи', exact: true }).fill('Наша история')
    if (mobile) await expect(page.getByRole('combobox', { name: 'Выбрать сессию', exact: true })).toBeDisabled()
    else await expect(page.getByRole('button', { name: 'Сессия #2: Вторая', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Новая сессия', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Название записи', exact: true })).toHaveCount(0)
    await expect(page.getByText('Наша история', { exact: true })).toBeVisible()
    await chooseMeeting(page, mobile, 2, 'Вторая')
    await expect(page.getByText('Наша история', { exact: true })).toHaveCount(0)
    await chooseMeeting(page, mobile, 1, 'Первая')
    await expect(page.getByText('Наша история', { exact: true })).toBeVisible()
    expect(writes.map(write => write.path)).toEqual(['/api/journals/journal/sections/101/entries', '/api/journals/journal/entries/700'])
  })
}
