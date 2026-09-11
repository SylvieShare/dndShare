import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { collectCharacterResources, setCharacterResourceAvailable, restoreCharacterResources } from './characterResources'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { bindDamageResources, spendDamageResources } from './weaponDamageResources'
import { restoreDawnResources } from './dawnResources'
import { weaponDamageActionFormula } from '@/shared/lib/weaponDamageOptions'

const sql = readFileSync(new URL('../../../../../internal/store/schema/99_magic_weapon_refresh.sql', import.meta.url), 'utf8')
const section = tag => JSON.parse(sql.split(`$${tag}$`)[1])
const resources = section('resources'), additions = section('additions')
function fixture(id, magic = {}) {
  const row = resources.find(r => r.id === id) || additions.find(r => r.id === id)
  const item = { id, typeId: 19, name: row.name, data: { weapon: { base_item_id: 37 }, activation: 'equipped', attunement: 'required',
    ...resources.find(r => r.id === id)?.patch, ...additions.find(r => r.id === id)?.patch } }
  const entry = uid => ({ uid, item_id: 37, magic_item_id: id, params: { magic: { attuned: true, ...magic } } })
  return { items: new Map([[String(id), item]]), values: { lvl: { level: 5 }, weapon: [entry('first'), entry('second')] } }
}

it('spends the joint thunder power without touching the four independent uses or another copy', () => {
  const { values, items } = fixture(88)
  const pools = collectCharacterResources(values, items)
  expect(pools).toHaveLength(10)
  const combined = collectCharacterFeatureActions(values, items, pools).find(a => a.key.includes('first') && a.title === 'Гром и молния')
  expect(combined.resource.source.resourceKey).toBe('thunder_lightning')
  const next = { ...values, ...setCharacterResourceAvailable(values, items, combined.resource.key, 0) }
  expect(collectCharacterResources(next, items).filter(r => r.value === 0).map(r => r.source.resourceKey)).toEqual(['thunder_lightning'])
  expect(restoreCharacterResources(next, items, 'long').patch).toEqual({})
  const dawn = restoreDawnResources(next, items)
  expect(dawn.results).toHaveLength(1)
  expect(collectCharacterResources({ ...next, ...dawn.patch }, items).every(r => r.value === 1)).toBe(true)
})
it.each([[88, '2d6', '4d6', 9], [164, '1d6', '2d6', 12]])('binds the charged strike of %i to its own pool and doubles dice only', (id, normal, critical, damageType) => {
  const { values, items } = fixture(id)
  const rows = matchingWeaponDamageActions(collectCharacterCombatEffects(values, items), { weaponUid: 'first', melee: true })
  const actions = bindDamageResources(rows, collectCharacterResources(values, items))
  expect(actions).toHaveLength(1)
  expect(actions[0].damage_type).toBe(damageType)
  expect(weaponDamageActionFormula(actions[0])).toBe(normal)
  expect(weaponDamageActionFormula(actions[0], true)).toBe(critical)
  const result = spendDamageResources(values, items, actions, [actions[0].key])
  expect(result.error).toBe('')
  expect(result.costs[0].cost).toBe(1)
  expect(result.patch.weapon[1]).toEqual(values.weapon[1])
  expect(collectCharacterResources({ ...values, ...result.patch }, items).find(r => r.key === actions[0].resource.key).value).toBe(actions[0].resource.total - 1)
})
it('does not spend dagger coating twice or double saving-throw poison dice on critical', () => {
  const { values, items } = fixture(149)
  Object.assign(items.get('149').data, { max_use: 1 })
  const actions = matchingWeaponDamageActions(collectCharacterCombatEffects(values, items), { weaponUid: 'first' })
  expect(weaponDamageActionFormula(actions[0], true)).toBe('2d10')
  expect(actions[0].damage_type).toBe(4)
  expect(spendDamageResources(values, items, actions, [actions[0].key]).patch).toEqual({})
})
it.each(resources)('restores $name at dawn, within its maximum, independently of rest and other copies', ({ id, patch }) => {
  const { values, items } = fixture(id, { remaining: 0 })
  values.weapon[1].params.magic.remaining = patch.max_use
  expect(restoreCharacterResources(values, items, 'short').patch).toEqual({})
  expect(restoreCharacterResources(values, items, 'long').patch).toEqual({})
  const result = restoreDawnResources(values, items, () => ({ total: 100 }))
  expect(result.results).toHaveLength(1)
  expect(result.results[0].after).toBe(patch.max_use)
  expect(result.patch.weapon[1]).toEqual(values.weapon[1])
})
