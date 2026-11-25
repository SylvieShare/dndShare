import { expect, test } from '@playwright/test'

test('карточка и редактор загружают имя сохранённой ссылки и сохраняют её без повторного выбора', async ({ page }) => {
  const fields = [{ key: 'parent', name: 'Родительская запись', type: 'item', item_type: 8, reference_shape: 'object', required: true }]
  const type = { id: 78, sourceId: 1, name: 'Коллекция', fields }
  const item = { id: 401, userId: 7, typeId: type.id, name: 'Тестовая запись', data: { parent: { id: 42 } } }
  const parent = { id: 42, typeId: 8, name: 'Лесной эльф', data: {} }
  let saved
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'PUT' && url.pathname === '/api/items/401') {
      saved = route.request().postDataJSON()
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/api/items/by-ids') {
      const ids = url.searchParams.get('ids').split(',').map(Number)
      return route.fulfill({ json: { items: [item, parent].filter(row => ids.includes(row.id)) } })
    }
    const responses = {
      '/api/user/checkAuth': { auth: true, user: { id: 7, login: 'Автор', roles: [] } },
      '/api/sources': { sources: [{ id: 1, name: 'D&D 5e', versions: [{ id: 1, version: '2014' }] }] },
      '/api/item-types': { types: [type] },
      '/api/items': { items: [item] },
      '/api/content-sources': { sources: [] },
    }
    return route.fulfill({ json: responses[url.pathname] || {} })
  })
  await page.goto('/handbook/objects?type=78')
  await page.locator('.list-row').getByText(item.name, { exact: true }).click()
  const detail = page.locator('.handbook-detail')
  await expect(detail.getByText(parent.name, { exact: true })).toBeVisible()
  await detail.getByRole('button', { name: 'Редактировать', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog.getByRole('button', { name: fields[0].name, exact: true })).toHaveText(parent.name)
  const save = dialog.getByRole('button', { name: 'Сохранить', exact: true })
  await save.click()
  await expect.poll(() => saved?.data.parent).toEqual({ id: 42 })
  await expect(dialog).toHaveCount(0)
  await detail.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await dialog.getByRole('button', { name: 'Очистить: Родительская запись', exact: true }).click()
  await expect(save).toBeDisabled()
})
