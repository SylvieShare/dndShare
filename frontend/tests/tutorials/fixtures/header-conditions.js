import { fixture } from './character-layout.js'

export async function conditionRowFixture(page) {
  const api = await fixture(page)
  const names = ['Благословение', 'Без сознания', 'Отравление', 'Истощение', 'Испуг', 'Ослепление', 'Оглушение', 'Опутанность']
  const items = names.map((name, index) => ({ id: 950 + index, typeId: 15, name, data: { desc: 'Проверочное состояние' } }))
  api.document().values.states = items.map(item => ({ uid: `condition-${item.id}`, effect_id: item.id, duration: { kind: 'manual' } }))
  await page.route(url => url.pathname === '/api/items/by-ids', route => route.fulfill({ json: { items } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: {
    protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [],
    metadata: { types: [], suggests: {}, suggestTypes: [], books: [] },
  } }))
  return { api, names }
}
