import { expect, test } from '@playwright/test'

const sources = [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }]
const createdAt = '2026-11-12T00:00:00Z'
const report = (id, extra = {}) => ({
  id, title: `Ошибка ${id}`, description: 'Кнопка не работает', pageUrl: '/handbook',
  element: { selector: '.hb-collection-card' }, status: 'OPEN', approved: true,
  userId: 1, userLogin: 'tester', messages: [], createdAt, ...extra,
})

async function fixture(page, { roles = [], reports = [], onCreate } = {}) {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/error-reports' && request.method() === 'POST') return onCreate(route)
    const answer = path.match(/\/error-report-review\/reports\/(\d+)\/messages$/)
    if (answer) {
      const target = reports.find(item => item.id === Number(answer[1]))
      target.waitingForAnswer = false
      const message = { id: 22, sender: 'ADMIN', message: request.postDataJSON().message, createdAt }
      target.messages.push(message)
      return route.fulfill({ json: message })
    }
    const approval = path.match(/\/admin-panel\/error-reports\/(\d+)\/approval$/)
    if (approval) {
      reports.find(item => item.id === Number(approval[1])).approved = request.postDataJSON().approved
      return route.fulfill({ json: { approved: request.postDataJSON().approved } })
    }
    return route.fulfill({ json: {
      '/api/user/checkAuth': { auth: true, user: { id: 1, login: 'tester', roles, hasCharacters: true, gameContext: { sourceVersionId: 1 } } },
      '/api/sources': { sources }, '/api/item-types': { types: [{ id: 5, name: 'Заклинания', sourceId: 1, countItems: 3, fields: [] }] },
      '/api/suggest/types': { items: [] }, '/api/sessions/active': { sessions: [] },
      '/api/error-report-review/reports': { reports }, '/api/admin-panel/error-reports': { reports },
    }[path] || {} })
  })
}

for (const [format, width, height] of [['phone', 390, 900], ['tablet', 834, 1100], ['wide', 1920, 1000]]) {
  test(`report with a real screenshot, context and retry on ${format}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let attempts = 0
    let submitted
    await fixture(page, { onCreate: async route => {
      attempts++
      submitted = route.request().postDataJSON()
      return attempts === 1
        ? route.fulfill({ status: 503, json: { desc: 'Повторите попытку' } })
        : route.fulfill({ status: 201, json: report(42) })
    } })
    await page.goto('/handbook')
    await expect(page.locator('.hb-collection-card')).toHaveCount(1)
    // Native/offline media can be blob URLs. The captured backing image must survive.
    await page.evaluate(() => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="rgb(40,35,55)"/></svg>'
      const backing = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      document.querySelector('.hb-collection-card').style.backgroundImage = `url("${backing}")`
    })
    if (width < 1200) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await page.getByRole('button', { name: 'Сообщить об ошибке', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Выберите проблемный элемент' })).toBeVisible()
    await page.locator('.hb-collection-card').click()
    const dialog = page.getByRole('dialog', { name: 'Что работает неправильно?' })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/handbook$/)
    const screenshot = dialog.getByAltText('Скриншот выбранного элемента')
    await expect(screenshot).toBeVisible({ timeout: 20000 })
    await expect(screenshot).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await dialog.getByRole('button', { name: 'Взять больше контекста' }).click()
    await expect(dialog.getByText('Контекст +1', { exact: true })).toBeVisible()
    const description = dialog.getByRole('textbox')
    await description.fill('При нажатии не открывается список заклинаний')
    await expect(dialog.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled()
    await page.screenshot({ path: info.outputPath(`${format}-report-form.png`) })
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog.getByText('Не удалось отправить заявку. Попробуйте ещё раз.')).toBeVisible()
    await expect(description).toHaveValue('При нажатии не открывается список заклинаний')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Заявка об ошибке отправлена' })).toBeVisible()
    expect(submitted.element.selector).toBeTruthy()
    expect(submitted.element.screenshotContextLevel).toBe(1)
    expect(submitted.element.platform).toBe(format === 'phone' ? 'mobile' : format === 'tablet' ? 'tablet' : 'desktop')
    expect(submitted.screenshot).toMatch(/^data:image\/jpeg;base64,/)
    expect(submitted.description).toBe('При нажатии не открывается список заклинаний')
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('ADMIN sees the inbox, answers questions and approves reports in the admin tab', async ({ page }) => {
  const reports = [report(1, { approved: false }), report(2, { status: 'IN_PROGRESS' }), report(3, {
    waitingForAnswer: true, messages: [{ id: 1, sender: 'AI', message: 'Какие шаги?', createdAt }],
  })]
  await fixture(page, { roles: ['ADMIN'], reports })
  await page.goto('/handbook')
  await page.getByRole('button', { name: 'Открыть список заявок: 3' }).click()
  await expect(page.locator('.review-inbox').getByText('В работе', { exact: true })).toBeVisible()
  await page.locator('.review-inbox').getByText('Ошибка 3', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Ошибка 3' })
  await dialog.getByRole('textbox').fill('Открыть справочник')
  await dialog.getByRole('button', { name: 'Отправить ответ' }).click()
  await expect(dialog.getByText('Открыть справочник', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/admin?tab=error-reports')
  await expect(page.getByRole('tab', { name: 'Ошибки страниц' })).toHaveAttribute('aria-selected', 'true')
  const card = page.locator('.report-card').filter({ has: page.getByRole('heading', { name: 'Ошибка 1', exact: true }) })
  await card.getByRole('checkbox').click()
  await expect(card.getByText('Обработка одобрена', { exact: true })).toBeVisible()
  expect(reports[0].approved).toBe(true)
})

test('hotkey cancels selection and submission works if screenshot capture fails', async ({ page }) => {
  let submitted
  await fixture(page, { onCreate: async route => { submitted = route.request().postDataJSON(); await route.fulfill({ status: 201, json: report(5) }) } })
  await page.goto('/handbook')
  await expect(page.locator('.hb-collection-card')).toHaveCount(1)
  await page.keyboard.press('Alt+Shift+E')
  await page.keyboard.press('Escape')
  await expect(page.locator('.selection-hint')).toHaveCount(0)
  await page.evaluate(() => { HTMLCanvasElement.prototype.getContext = () => null })
  await page.keyboard.press('Alt+Shift+E')
  await page.locator('.hb-collection-card').click()
  const dialog = page.getByRole('dialog', { name: 'Что работает неправильно?' })
  await expect(dialog.getByText('Заявку можно отправить без снимка элемента.', { exact: false })).toBeVisible({ timeout: 20000 })
  await dialog.getByRole('textbox').fill('Ошибка без снимка')
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted.screenshot).toBeUndefined()
})
