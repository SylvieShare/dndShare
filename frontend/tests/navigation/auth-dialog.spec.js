import { expect, test } from '@playwright/test'

const sources = [{ id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }]
const user = { id: 1, login: 'new-player', roles: [], hasCharacters: false }

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: {
      '/api/user/checkAuth': { auth: false }, '/api/sources': { sources },
      '/api/templates': { templates: [{ id: 1, name: 'DND5' }] },
      '/api/item-types': { types: [{ id: 5, name: 'Заклинания', countItems: 1, fields: [] }] },
      '/api/suggest/types': { items: [] }, '/api/suggest/batch': { items: {} },
    }[path] || { items: [] } })
  })
})

for (const width of [390, 1024]) {
  test(`anonymous creation opens one login with the drawer closed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chars/new')
    await expect(page.getByRole('dialog', { name: 'Меню приложения' })).toHaveCount(0)
    const create = page.locator('.rail-incomplete:visible, .incomplete-mobile:visible')
    await expect(create).toBeEnabled({ timeout: 20000 })
    await create.click()
    const login = page.getByRole('dialog', { name: 'Вход', exact: true })
    await expect(login).toHaveCount(1)
    await expect(login).toContainText('Для создания персонажа войдите или зарегистрируйтесь.')
    await expect(login.getByPlaceholder('Введите пароль')).toHaveCount(1)
    await login.getByRole('button', { name: 'Регистрация', exact: true }).click()
    await expect(login).toHaveCount(0)
    const registration = page.getByRole('dialog', { name: 'Регистрация', exact: true })
    await expect(registration).toHaveCount(1)
    await expect(registration).toContainText('Для создания персонажа войдите или зарегистрируйтесь.')
    await page.keyboard.press('Escape')
    await expect(registration).toHaveCount(0)
    await expect(create).toBeEnabled({ timeout: 20000 })
  })

  test(`sidebar auth survives drawer removal, closure and resize at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/api/user/auth', route => route.fulfill({ json: { auth: false } }))
    await page.goto('/handbook')
    await expect(page.locator('.hb-collection-card')).toHaveCount(1, { timeout: 20000 })
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Меню приложения' })
    await drawer.getByRole('button', { name: 'Войти', exact: true }).click()
    const login = page.getByRole('dialog', { name: 'Вход', exact: true })
    await login.getByPlaceholder('Введите логин').fill('draft-player')
    await login.getByPlaceholder('Введите пароль').fill('draft-password')
    await page.evaluate(() => {
      for (let i = 0; i < 2; i++) window.dispatchEvent(new CustomEvent('dndshare:request-auth', { detail: { reason: 'create-character' } }))
    })
    await expect(login).toHaveCount(1)
    // Submitting changes account status and closes the drawer through the shell.
    await login.getByRole('button', { name: 'Войти', exact: true }).click()
    await expect(drawer).toHaveCount(0)
    await expect(login.getByText('Неверный логин или пароль', { exact: true })).toBeVisible()
    await expect(login.getByPlaceholder('Введите пароль')).toHaveValue('draft-password')
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(drawer).toHaveCount(0)
    await expect(login.getByPlaceholder('Введите логин')).toHaveValue('draft-player')
    await expect(login.getByPlaceholder('Введите пароль')).toHaveValue('draft-password')
    await page.setViewportSize({ width, height: 900 })
    await expect(login).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(login).toHaveCount(0)
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await drawer.getByRole('button', { name: 'Закрыть меню', exact: true }).click()
    await expect(drawer).toHaveCount(0)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dndshare:request-auth', { detail: { reason: 'clone-character' } })))
    await expect(login).toHaveCount(1)
    await expect(login).toContainText('После входа нажмите «Клонировать себе» снова.')
    await expect(login.getByPlaceholder('Введите пароль')).toHaveValue('draft-password')
  })
}

test('failed login keeps one form and request per submit, with reduced error motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 834, height: 900 })
  const credentials = []
  await page.route('**/api/user/auth', route => {
    credentials.push(route.request().postDataJSON())
    return route.fulfill({ json: { auth: false } })
  })
  await page.goto('/handbook')
  await page.locator('.desktop-sidebar--rail').getByRole('button', { name: 'Войти', exact: true }).click()
  const login = page.getByRole('dialog', { name: 'Вход', exact: true })
  await login.getByPlaceholder('Введите логин').fill('player')
  await login.getByPlaceholder('Введите пароль').fill('wrong-password')
  for (let attempt = 1; attempt <= 2; attempt++) {
    await login.getByRole('button', { name: 'Войти', exact: true }).click()
    await expect(login.getByText('Неверный логин или пароль', { exact: true })).toBeVisible()
    await expect.poll(() => credentials.length).toBe(attempt)
    await expect(login).toHaveCount(1)
  }
  expect(credentials).toEqual(Array(2).fill({ login: 'player', password: 'wrong-password' }))
  await expect(login.locator('.auth-form')).toHaveCSS('animation-name', 'none')
})

test('registration uses the existing HTTP form and renders the signed-in account without transition warnings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  let registered = false
  const warnings = []
  page.on('console', message => { if (message.text().includes('non-element root node')) warnings.push(message.text()) })
  await page.route('**/api/user/checkAuth', route => route.fulfill({ json: registered ? { auth: true, user } : { auth: false } }))
  await page.route('**/api/user/registration', route => {
    expect(route.request().postDataJSON()).toEqual({ login: 'new-player', password: 'new-password' })
    registered = true
    return route.fulfill({ json: {} })
  })
  await page.goto('/handbook')
  await page.getByRole('button', { name: 'Регистрация', exact: true }).click()
  const registration = page.getByRole('dialog', { name: 'Регистрация', exact: true })
  await registration.getByPlaceholder('Придумайте логин').fill(' new-player ')
  await registration.getByPlaceholder('Придумайте пароль').fill('new-password')
  await registration.getByPlaceholder('Повторите пароль', { exact: true }).fill('new-password')
  await page.setViewportSize({ width: 834, height: 900 })
  await expect(registration.getByPlaceholder('Повторите пароль', { exact: true })).toHaveValue('new-password')
  await registration.getByRole('button', { name: 'Создать аккаунт', exact: true }).click()
  await expect(registration).toHaveCount(0)
  await expect(page.locator('.desktop-sidebar--rail').getByRole('button', { name: 'new-player', exact: true })).toBeVisible()
  expect(warnings).toEqual([])
})
