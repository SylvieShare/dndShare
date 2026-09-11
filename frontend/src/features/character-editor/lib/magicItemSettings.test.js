import { expect, it } from 'vitest'
import { fillMissingMagicBases, missingMagicBases, setInstanceAttunement } from './magicItemSettings'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterResources, setCharacterResourceAvailable, restoreCharacterResources } from './characterResources'
const item = { id: 178, typeId: 19, name: 'Трезубец управления рыбами', data: {
  weapon: { base_item_id: 58 }, attunement: 'required', activation: 'equipped', max_use: 3,
  recharge_note: 'На рассвете 1к3',
  feature_actions: [{ key: 'fish_command', title: 'Управление рыбами', action_type: 'action', uses_resource: true, resource_cost: 1 }],
} }
const entry = { uid: 'trident', item_id: 58, magic_item_id: 178, params: { magic: { attuned: true, remaining: 2, choices: { option: ['one'] } } }, desc: 'Мой трезубец' }
const catalogue = new Map([['178', item]])
function state(location) {
  const row = structuredClone(entry)
  return { lvl: { level: 1 }, weapon: location === 'weapon' ? [row] : [], items: { equipped: location === 'equipped' ? [row] : [], sections: [{ id: 'bag', items: location === 'bag' ? [row] : [] }] } }
}
it.each(['weapon', 'equipped'])('exposes the trident action and its own charges from %s, gated by attunement', location => {
  const values = state(location)
  const resources = collectCharacterResources(values, catalogue)
  const [action] = collectCharacterFeatureActions(values, catalogue, resources)
  expect(action).toMatchObject({ title: 'Управление рыбами', action_type: 'action', resource_cost: 1, resource: { total: 3, value: 2 } })
  expect(action.resource.key).toBe(resources[0].key)
  const spent = { ...values, ...setCharacterResourceAvailable(values, catalogue, action.resource.key, 1) }
  const off = { ...spent, ...setInstanceAttunement(spent, item, entry.uid, false) }
  expect(collectCharacterFeatureActions(off, catalogue)).toEqual([])
  expect(collectCharacterResources(off, catalogue)).toEqual([])
  const on = { ...off, ...setInstanceAttunement(off, item, entry.uid, true) }
  expect(collectCharacterResources(on, catalogue)[0].value).toBe(1)
  expect(restoreCharacterResources(on, catalogue, 'long').patch).toEqual({})
})
it('does not activate equipped-only dependencies in the backpack; carried items retain their own policy', () => {
  expect(collectCharacterFeatureActions(state('bag'), catalogue)).toEqual([])
  expect(collectCharacterResources(state('bag'), catalogue)).toEqual([])
  const carried = new Map([['178', { ...item, data: { ...item.data, activation: 'carried' } }]])
  expect(collectCharacterFeatureActions(state('bag'), carried)).toHaveLength(1)
})
it('supports non-weapon magic items in equipment and does not reset another instance', () => {
  const values = state('equipped')
  values.items.equipped = [{ ...structuredClone(entry), item_id: 178, magic_item_id: undefined }, { ...structuredClone(entry), uid: 'other' }]
  const off = setInstanceAttunement(values, item, entry.uid, false)
  expect(off.items.equipped[0]).toMatchObject({ desc: entry.desc, params: { magic: { attuned: false, remaining: 2, choices: { option: ['one'] } } } })
  expect(off.items.equipped[1]).toEqual(values.items.equipped[1])
  expect(collectCharacterFeatureActions({ ...values, ...off }, catalogue)).toHaveLength(1)
  expect(values.items.equipped[0].params.magic.attuned).toBe(true)
})
it('allows selecting only a missing base and preserves state; existing bases cannot be replaced', () => {
  const variable = { ...item, data: { ...item.data, weapon: { allowed_base_item_ids: [58, 49] } } }
  const values = state('weapon')
  expect(missingMagicBases(variable, entry)).toEqual([])
  expect(fillMissingMagicBases(values, variable, entry.uid, { weapon_base_item_id: 49 })).toEqual({})
  values.weapon = []
  values.items.equipped = [{ ...structuredClone(entry), item_id: 178, magic_item_id: undefined }]
  expect(fillMissingMagicBases(values, variable, entry.uid, { weapon_base_item_id: 99 })).toEqual({})
  const patch = fillMissingMagicBases(values, variable, entry.uid, { weapon_base_item_id: 58 })
  expect(patch.items.equipped[0]).toMatchObject({ item_id: 58, magic_item_id: 178, params: entry.params, desc: entry.desc })
  expect(fillMissingMagicBases({ ...values, ...patch }, variable, entry.uid, { weapon_base_item_id: 49 })).toEqual({})
  const armor = { id: 10, typeId: 19, data: { armor_base: { allowed_base_item_ids: [12, 13] } } }
  expect(missingMagicBases(armor, { params: { armor_base_item_id: 12 } })).toEqual([])
})
