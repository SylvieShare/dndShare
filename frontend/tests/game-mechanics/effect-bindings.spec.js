import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const fixtures = JSON.parse(readFileSync(new URL('../../../native/fixtures/game-mechanics/effect-bindings.json', import.meta.url), 'utf8'))
const fieldNames = { value: 'Начальное значение', step: 'Размер шага', multiplier: 'Прибавка за шаг', minimum: 'Минимум результата', maximum: 'Максимум результата' }

for (const width of [390, 820, 1440]) for (const caseIndex of [0, 1]) {
  const fixture = fixtures[caseIndex]
  test(`автор создаёт и повторно открывает связь · ${fixture.name} · ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    page.on('pageerror', error => { throw error })
    const effect = { ...fixture.effect, compatibility: [{ sourceVersionId: 1, version: '2014', status: 'native' }] }
    let saved
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname
      if (path === '/api/items' && req.method() === 'POST') {
        saved = { ...req.postDataJSON(), id: 900, userId: 42 }
        return route.fulfill({ json: saved })
      }
      if (path === '/api/items/900' && req.method() === 'PUT') {
        saved = { ...saved, ...req.postDataJSON() }
        return route.fulfill({ status: 204 })
      }
      if (path === '/api/sources') return route.fulfill({ json: { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] } })
      if (path === '/api/user/checkAuth') return route.fulfill({ json: { auth: true, user: { id: 42, login: 'Автор', roles: ['HANDBOOK_ADMIN'] } } })
      if (path === '/api/content-sources') return route.fulfill({ json: { sources: [] } })
      if (path.startsWith('/api/suggest/')) return route.fulfill({ json: { items: {} } })
      if (path === '/api/items/rule-references') return route.fulfill({ json: { references: [] } })
      if (path.startsWith('/api/items')) return route.fulfill({ json: { items: [effect], total: 1 } })
      return route.fulfill({ json: {} })
    })
    await page.goto(`/tests/game-mechanics/effect-bindings.html?case=${caseIndex}`)
    await page.getByRole('button', { name: 'Создать заклинание', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Круг заклинания', exact: true }).fill(String(fixture.baseLevel))
    await page.getByRole('button', { name: 'Добавить настройки', exact: true }).click()
    await page.getByRole('dialog', { name: 'Добавить настройки', exact: true }).getByRole('button', { name: /Накладываемые эффекты/ }).click()
    await page.getByRole('button', { name: 'Эффект', exact: true }).click()
    await page.getByText(fixture.effect.name, { exact: true }).click()
    await page.getByRole('dialog', { name: 'Выбрать предмет', exact: true }).getByRole('button', { name: '+ Добавить', exact: true }).click()
    const source = page.getByRole('combobox', { name: /Источник значения/ })
    await expect(source).toBeVisible()
    await source.selectOption('slot_increase')
    await expect(source.locator('option[value="scaling_value"]')).toHaveCount(0)
    for (const [key, label] of Object.entries(fieldNames)) {
      if (fixture.binding[key] != null) await page.getByRole('spinbutton', { name: label, exact: true }).fill(String(fixture.binding[key]))
    }
    const submit = page.getByRole('button', { name: 'Создать', exact: true })
    await page.getByRole('spinbutton', { name: 'Размер шага', exact: true }).fill('0')
    await expect(submit).toBeDisabled()
    await page.getByRole('spinbutton', { name: 'Размер шага', exact: true }).fill(fixture.binding.step == null ? '' : String(fixture.binding.step))
    if (fixture.binding.maximum != null) {
      await page.getByRole('spinbutton', { name: 'Минимум результата', exact: true }).fill(String(fixture.binding.maximum + 1))
      await expect(submit).toBeDisabled()
      await page.getByRole('spinbutton', { name: 'Минимум результата', exact: true }).fill('')
    }
    await expect(submit).toBeEnabled()
    await submit.click()
    expect(saved.data.status_effects[0].parameter_bindings).toEqual([fixture.binding])
    expect(saved.data.status_effects[0].effect).toEqual({ id: fixture.effect.id })
    await page.reload()
    await page.getByRole('button', { name: 'Редактировать заклинание', exact: true }).click()
    await expect(source).toHaveValue('slot_increase')
    for (const [key, label] of Object.entries(fieldNames)) {
      if (fixture.binding[key] != null) await expect(page.getByRole('spinbutton', { name: label, exact: true })).toHaveValue(String(fixture.binding[key]))
    }
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    expect(saved.data.status_effects[0].parameter_bindings).toEqual([fixture.binding])
  })
}
