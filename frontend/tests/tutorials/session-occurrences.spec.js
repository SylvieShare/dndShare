import { test, expect } from '@playwright/test'
import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

async function mockMeetings(page, role, initial = [], failCreate = false) {
  let occurrences = initial.map(row => ({ ...row, sectionId: row.id + 100, entryCount: 0, changedAt: '2026-10-03T10:00:00Z' }))
  const writes = []
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
      }
      return route.fulfill({ json: { occurrences } })
    }
    let json = {}
    if (path === '/api/account/tutorials') json = { tutorials: ['desktop', 'mobile'].map(device => ({ flowId: `session-${role}`, sourceKey: 'source:1', device, revision: TUTORIAL_REVISION, status: 'completed' })) }
    if (path === '/api/sessions/test') json = { session: { uuid: 'test', name: 'Приключение', systemId: 1, ownerUserId: role === 'dm' ? 1 : 2, status: 'stopped' }, participants: [], myRole: role === 'dm' ? 'gm' : 'player' }
    if (path === '/api/sessions/test/occurrences') json = { occurrences }
    if (path === '/api/sessions/test/journal') json = {
      journal: { uuid: 'journal', kind: 'session', sessionUuid: 'test', name: 'Дневник кампании', playersCanEdit: false,
        sections: occurrences.map(row => ({ id: row.sectionId, occurrenceId: row.id, number: row.number, title: row.name, date: row.date || '', events: [] })) },
      canEdit: role === 'dm', canManage: role === 'dm',
    }
    await route.fulfill({ json })
  })
  return writes
}
test.beforeEach(({ page }) => { page.on('pageerror', error => { throw error }) })

for (const mobile of [false, true]) {
  test(`calendar creates a meeting, preserves a failed draft and opens its diary (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    const writes = await mockMeetings(page, 'dm', [], true)
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test%3Fview=schedule')
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
    await expect(calendar).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Дата сессии', exact: true })).toContainText('13 ноября 2089')
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Номер уже занят')
    await expect(page.getByRole('textbox', { name: 'Название сессии', exact: true })).toHaveValue('Тайна крепости')
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Тайна крепости', exact: true })).toBeVisible()
    expect(writes.map(write => write.body)).toEqual([{ number: 1, name: 'Тайна крепости', date: '2089-11-13' }, { number: 1, name: 'Тайна крепости', date: '2089-11-13' }])
    await page.getByRole('button', { name: 'Дневник сессии #1', exact: true }).click()
    await expect(page.getByRole('tab', { selected: true })).toContainText('Тайна крепости')
    await expect(page.getByRole('tab', { selected: true })).toContainText('13 ноября 2089')
    await expect(page.getByRole('button', { name: 'Новый раздел', exact: true })).toHaveCount(0)
  })
  test(`player sees next, future and past meetings and opens the selected diary (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    const writes = await mockMeetings(page, 'player', [
      { id: 1, number: 1, name: 'Первая игра', date: '2000-01-01' },
      { id: 3, number: 3, name: 'Позже', date: '2090-02-01' },
      { id: 2, number: 2, name: 'Ближайшая', date: '2090-01-01' },
    ])
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test')
    await expect(page.locator('.occurrence-card--next')).toContainText('Ближайшая')
    await expect(page.getByRole('heading', { name: /Будущие сессии/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Прошедшие сессии/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Новая сессия', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Редактировать сессию/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Дневник сессии #2', exact: true }).click()
    await expect(page.getByRole('tab', { selected: true })).toContainText('Ближайшая')
    await expect(page.getByRole('tab', { selected: true })).toContainText('#2')
    await expect(page.getByText('Только чтение · записи добавляет мастер')).toBeVisible()
    await page.getByRole('button', { name: 'К списку сессий', exact: true }).click()
    await expect(page.locator('.occurrence-card--next')).toContainText('Ближайшая')
    expect(writes).toEqual([])
  })
  test(`master edits meeting metadata and confirms deletion (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    const writes = await mockMeetings(page, 'dm', [
      { id: 1, number: 1, name: 'Сохранить соседнюю', date: '2090-01-01' },
      { id: 2, number: 2, name: 'До правки', date: '2090-02-01' },
    ])
    await page.goto('/tests/tutorials/fixtures/tutorials.html?page=/sessions/test%3Fview=schedule')
    await page.getByRole('button', { name: 'Редактировать сессию #2', exact: true }).click()
    await page.getByRole('textbox', { name: 'Название сессии', exact: true }).fill('После правки')
    await page.getByRole('spinbutton', { name: 'Номер сессии', exact: true }).fill('5')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    expect(writes[0]).toEqual({ path: '/api/sessions/test/occurrences/2', method: 'PATCH', body: { number: 5, name: 'После правки', date: '2090-02-01', expectedChangedAt: '2026-10-03T10:00:00Z' } })
    await page.getByRole('button', { name: 'Дневник сессии #5', exact: true }).click()
    await expect(page.getByRole('tab', { selected: true })).toContainText('После правки')
    await expect(page.getByRole('tab', { selected: true })).toContainText('#5')
    await page.getByRole('link', { name: 'Сессии кампании', exact: true }).click()
    await page.getByRole('button', { name: 'Удалить сессию #5', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Удалить сессию?', exact: true })).toContainText('все записи её дневника')
    await page.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(writes).toHaveLength(1)
    await page.getByRole('button', { name: 'Удалить сессию #5', exact: true }).click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'После правки', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Сохранить соседнюю', exact: true })).toBeVisible()
    expect(writes[1]).toEqual({ path: '/api/sessions/test/occurrences/2', method: 'DELETE', body: null })
  })
}
