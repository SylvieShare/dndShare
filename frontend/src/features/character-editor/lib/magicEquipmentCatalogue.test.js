import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { collectCharacterDefenses } from './characterDefenses'
import { collectCharacterResources, setCharacterResourceAvailable, restoreCharacterResources } from './characterResources'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { selectedDamageActions, weaponDamageActionFormula } from '@/shared/lib/weaponDamageOptions'

const sql = readFileSync(new URL('../../../../../internal/store/schema/94_magic_equipment_mechanics.sql', import.meta.url), 'utf8')
const patches = JSON.parse(sql.split('$mechanics$')[1])
function item(id, kind = 'weapon') {
  const row = patches.find(row => row.id === id)
  return { id, name: row.name, typeId: 19, data: { activation: 'equipped', attunement: 'required', [kind]: { base_item_id: 49 }, ...row.patch } }
}
const entry = (id, uid, magic = {}) => ({ item_id: 49, magic_item_id: id, uid, params: { magic: { attuned: true, ...magic } } })
const catalogue = (...items) => new Map(items.map(row => [String(row.id), row]))
it('uses the seeded mace dice on its own instance, doubles hit dice on critical, and gates attunement', () => {
  const items = catalogue(item(190)), values = { weapon: [entry(190, 'mace')], lvl: { level: 7 } }
  const effects = collectCharacterCombatEffects(values, items)
  const rows = matchingWeaponDamageActions(effects, { weaponUid: 'mace', melee: true })
  expect(weaponDamageActionFormula(rows[0])).toBe('2d6')
  expect(weaponDamageActionFormula(rows[0], true)).toBe('4d6')
  expect(matchingWeaponDamageActions(effects, { weaponUid: 'other', melee: true })).toEqual([])
  values.weapon[0].params.magic.attuned = false
  expect(collectCharacterCombatEffects(values, items).weaponDamage).toEqual([])
})
it('keeps natural-20 damage from doubling again, with a dependent construct increment', () => {
  const actions = matchingWeaponDamageActions(collectCharacterCombatEffects({ lvl: { level: 7 }, weapon: [entry(137, 'mace')] }, catalogue(item(137))), { weaponUid: 'mace' })
  expect(selectedDamageActions(actions, [actions[1].key])).toEqual([])
  const selected = selectedDamageActions(actions, actions.map(row => row.key))
  expect(selected.map(row => weaponDamageActionFormula(row, true))).toEqual(['2d6', '2d6'])
})
it('binds seeded charges to exactly one instance and does not restore dawn powers on a rest', () => {
  const items = catalogue(item(273)), values = { lvl: { level: 7 }, weapon: [entry(273, 'first'), entry(273, 'second')] }
  const resources = collectCharacterResources(values, items)
  const actions = collectCharacterFeatureActions(values, items, resources)
  expect(resources.map(r => r.value)).toEqual([3, 3])
  expect(actions.map(a => a.resource.key)).toEqual(resources.map(r => r.key))
  expect(actions[0].resource_cost).toBe(1)
  const spent = { ...values, ...setCharacterResourceAvailable(values, items, resources[0].key, 2) }
  expect(collectCharacterResources(spent, items).map(r => r.value)).toEqual([2, 3])
  expect(restoreCharacterResources(spent, items, 'long').patch).toEqual({})
})
it('keeps armor resistance choices independent and grants nothing until a variant is chosen', () => {
  const armor = item(114, 'armor_base'), items = catalogue(armor)
  const owned = (uid, choice) => ({ uid, item_id: 114, params: { magic: { attuned: true, choices: { dragon_scale: choice ? [choice] : [] } } } })
  const values = { lvl: { level: 7 }, items: { equipped: [owned('red', 'red'), owned('white', 'white'), owned('unknown')] } }
  expect(collectCharacterDefenses(values, items).map(r => r.damage_type)).toEqual([5, 13])
  values.items.equipped[0].params.magic.attuned = false
  expect(collectCharacterDefenses(values, items).map(r => r.damage_type)).toEqual([13])
})
it('gives the ethereal armor a charged entry action and a free exit', () => {
  const armor = item(289, 'armor_base'), items = catalogue(armor)
  const values = { lvl: { level: 7 }, items: { equipped: [{ item_id: 289, uid: 'armor', params: { magic: { attuned: true } } }] } }
  const resources = collectCharacterResources(values, items)
  const actions = collectCharacterFeatureActions(values, items, resources)
  const start = actions.find(a => a.title === 'Стать эфирным')
  const end = actions.find(a => a.title === 'Завершить эфирность')
  expect(start.resource_cost).toBe(1)
  expect(end.resource_cost).toBe(0)
  expect(start.resource).toBe(resources[0])
  expect(end.resource).toBeNull()
})
