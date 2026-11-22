import { readFileSync } from 'node:fs'
import { fixture } from './character-layout.js'

const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))
export const grantedSpellName = 'Адское возмездие'

export async function installSpellCardSheet(page) {
  const api = await fixture(page)
  await page.route('**/api/build-info', route => route.fulfill({
    json: { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend },
  }))
  await page.route('**/api/handbook/sync?**', route => route.fulfill({ json: { protocol: 1, entries: [], cursor: 'test', hasMore: false } }))
  const grantedSpell = {
    id: 555, typeId: 5, name: grantedSpellName, nameEn: 'Hellish Rebuke', iconImageUrl: '/static/spell-range.svg',
    data: { lvl: 1, duration: 'Мгновенная', damage: { save_ability: 'dex', dices: [{ dice_id: 'd10', count: 2 }] } },
  }
  const spells = [
    { id: 551, typeId: 5, name: 'Мистический заряд', nameEn: 'Eldritch Blast', data: { lvl: 0, damage: { range_attack: true, dices: [{ dice_id: 'd10', count: 1 }] } } },
    { id: 552, typeId: 5, name: 'Луч холода', nameEn: 'Ray of Frost', data: { lvl: 0, damage: { range_attack: true, dices: [{ dice_id: 'd8', count: 1 }] } } },
    { id: 553, typeId: 5, name: 'Лечение ран', nameEn: 'Cure Wounds', data: { lvl: 1, heal: { apply: false, add_mod: true, dices: [{ dice_id: 'd8', count: 1 }] } } },
    { id: 554, typeId: 5, name: 'Ложная жизнь', nameEn: 'False Life', data: { lvl: 1, heal: { kind: 'temporary_hp', dices: [{ dice_id: 'd4', count: 1, bonus: 4 }] } } },
  ]
  const items = [...spells, grantedSpell]
  for (const spell of items) {
    spell.coverImageUrl = '/tests/tutorials/fixtures/spell-covers/default.webp'
    Object.assign(spell.data, { time: { kind: 'action' }, range: { kind: 'ranged', distance: 60 }, components: { v: true, s: true } })
  }
  api.document().values.spells = { schema_version: 2, slot_pools: { long_rest: [{ level: 1, total: 3, used: 0 }], short_rest: [] },
    tabs: [{ key: 'book', name: 'Волшебник', mode: 'known', casting_ability: 4, spells: spells.map(spell => ({ key: `s:${spell.id}`, id: spell.id })) }],
    grants: [{ key: 'innate:555', id: grantedSpell.id, slotless: true, cast_level: 2, source: { label: 'Дьявольское наследие' } }] }
  await page.route('**/api/items/by-ids?**', route => route.fulfill({ json: { items: new URL(route.request().url()).searchParams.get('ids').split(',').map(Number).map(id => items.find(spell => spell.id === id)).filter(Boolean) } }))
}
