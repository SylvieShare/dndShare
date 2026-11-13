import { fixture } from './character-layout.js'

export async function weaponSheetFixture(page, owner = true) {
  const api = await fixture(page, 'DND5', owner, true)
  api.document().values.weapon[0].proficient = true
  const catalogue = {
    201: { id: 201, typeId: 1, name: 'Тестовое копьё', data: { attacks: [{ count: 1, dice_id: 'd6', type: 1 }], universe_attacks: [{ count: 1, dice_id: 'd8', type: 1 }] } },
    205: { id: 205, typeId: 5, name: 'Ярость', data: { derived_effects: [{ kind: 'weapon_damage_bonus', value: 2 }] } },
  }
  await page.route('**/api/items/by-ids?**', route => {
    const ids = new URL(route.request().url()).searchParams.get('ids').split(',').map(Number)
    return route.fulfill({ json: { items: ids.map(id => catalogue[id] || { id, typeId: id === 203 ? 3 : id === 206 ? 6 : 5, name: 'Предмет ' + id, data: id === 206 ? { lvl: 1 } : {} }) } })
  })
  const suggests = {
    16: ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'].map((value, i) => ({ id: i + 1, typeId: 16, value })),
    12: [{ id: 1, typeId: 12, value: 'Колющий' }], 14: [], 15: [],
  }
  await page.route('**/api/suggest/batch?**', route => route.fulfill({ json: { items: suggests } }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests, suggestTypes: [], books: [] } } }))
  return { ...api, catalogue, suggests }
}
