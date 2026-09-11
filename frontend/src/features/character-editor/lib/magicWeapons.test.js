import { describe, expect, it } from 'vitest'
import { createWeaponInstance, intrinsicWeaponBonus, resolveWeaponItem, weaponBaseId } from './magicWeapons'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { collectCharacterDerivedEffects, derivedNumericBonus } from './characterDerivedEffects'
import { useWeaponCalc } from '../blocks/dnd/composables/useWeaponCalc'
import { ref } from 'vue'

const sword = { id: 49, typeId: 1, name: 'Меч', data: { attacks: [{ count: 1, dice_id: 'd8', type: 2 }], tags: [10], required_weapon_proficiencies: [27, 16], universe_attacks: [{ count: 1, dice_id: 'd10', type: 2 }] } }
const magic = { id: 263, typeId: 19, name: 'Солнечный клинок', data: { weapon: { base_item_id: 49, magic_bonus: 2, damage_type: 7, extra_tags: [11], extra_proficiencies: [17] }, attunement: 'required', activation: 'equipped' } }
const entry = { uid: 'blade', item_id: 49, magic_item_id: 263, count: 1, params: { magic: { attuned: true, remaining: 2 }, note: 'keep' } }
const values = () => ({ lvl: { level: 7 }, weapon: [structuredClone(entry)], items: { equipped: [], sections: [] } })
const catalogue = { 49: sword, 263: magic }

describe('magic weapon instances', () => {
  it('resolves physical properties without changing the catalogue or duplicating the item', () => {
    const state = values(), rows = state.weapon
    expect(rows).toHaveLength(1)
    const weapon = resolveWeaponItem(rows[0], catalogue)
    expect(weapon).toMatchObject({ id: 263, typeId: 19, data: { attacks: [{ dice_id: 'd8', type: 7 }], universe_attacks: [{ dice_id: 'd10', type: 7 }], tags: [10, 11], required_weapon_proficiencies: [27, 16, 17] } })
    expect(sword.data.attacks[0].type).toBe(2)
    expect(state.items.equipped).toEqual([])
    state.items.sections.push({ items: state.weapon }); state.weapon = []
    expect(state.weapon).toEqual([])
  })
  it('creates a weapon with base and magic references without copying catalogue stats', () => {
    const made = createWeaponInstance(magic, { uid: 'new', item_id: magic.id, params: { magic: { remaining: 2 } } })
    expect(made).toEqual({ uid: 'new', item_id: 49, magic_item_id: 263, params: { magic: { remaining: 2 } } })
    expect(made.data).toBeUndefined()
  })
  it('recalculates base stats with magical overrides and the instance name', () => {
    const updated = { ...sword, data: { ...sword.data, attacks: [{ count: 2, dice_id: 'd6', type: 2 }] } }
    const row = { ...entry, override: { name: 'Мой клинок', desc: '<p>История</p>' } }
    const weapon = resolveWeaponItem(row, { ...catalogue, 49: updated })
    expect(weapon).toMatchObject({ name: 'Мой клинок', data: { desc: '<p>История</p>', attacks: [{ count: 2, dice_id: 'd6', type: 7 }] } })
    expect(updated.data.attacks[0].type).toBe(2)
  })
  it('requires a valid per-instance choice for variable weapons', () => {
    const item = { ...magic, data: { weapon: { allowed_base_item_ids: [49] } } }
    expect(weaponBaseId(item, { params: {} })).toBeNull()
    expect(weaponBaseId(item, { params: { weapon_base_item_id: 36 } })).toBeNull()
    expect(weaponBaseId(item, { params: { weapon_base_item_id: 49 } })).toBe(49)
    expect(resolveWeaponItem(entry, { ...catalogue, 49: { ...sword, typeId: 2 } })).toBeNull()
  })
  it('gates the built-in bonus by attunement and adds it once to attack and critical damage', () => {
    const state = values(), row = state.weapon[0]
    expect(intrinsicWeaponBonus(row, magic, state)).toBe(2)
    row.params.magic.attuned = false
    expect(intrinsicWeaponBonus(row, magic, state)).toBe(0)
    expect(intrinsicWeaponBonus(row, { ...magic, data: { ...magic.data, weapon: { ...magic.data.weapon, bonus_without_attunement: true } } }, state)).toBe(2)
    row.params.magic.attuned = true
    const resolved = resolveWeaponItem(row, catalogue)
    const calc = useWeaponCalc({ statsVar: ref({ 1: 3, 2: 2 }), profBonus: ref(3), diceMap: ref({ d8: 'd8' }), diceDetailsMap: ref({}), damageTypeMap: ref({}), damageTypeDetailsMap: ref({}), item: () => resolved, propertyItems: () => [], itemBaseAttacks: () => resolved.data.attacks, isProficient: () => true, magicBonusModifier: r => intrinsicWeaponBonus(r, magic, state) })
    expect(calc.attackBonus(row)).toBe(8)
    expect(calc.damageExpression(row)).toBe('1d8{7}+5{7}')
    expect(calc.criticalDamageExpression(row)).toBe('2d8{7}+5{7}')
  })
  it('limits weapon dependencies to their own instance', () => {
    const item = { ...magic, data: { ...magic.data, weapon_damage: [{ key: 'fire', dice: 'd6', dice_count: 2 }], derived_effects: [{ kind: 'weapon_attack_bonus', value: 1 }] } }
    const map = new Map([['263', item]]), state = values()
    const effects = collectCharacterCombatEffects(state, map)
    expect(matchingWeaponDamageActions(effects, { weaponUid: 'blade' })).toHaveLength(1)
    expect(matchingWeaponDamageActions(effects, { weaponUid: 'other' })).toEqual([])
    const derived = collectCharacterDerivedEffects(state, map)
    expect(derivedNumericBonus(derived, 'weapon_attack_bonus', state, { targetId: 'blade' }).total).toBe(1)
    expect(derivedNumericBonus(derived, 'weapon_attack_bonus', state, { targetId: 'other' }).total).toBe(0)
  })
})

it('spends and restores charges on one weapon instance and preserves them through inventory', async () => {
  const { collectCharacterResources, setCharacterResourceAvailable, restoreCharacterResources } = await import('./characterResources')
  const { appendInventoryEntry, weaponEntryToOwnedEntry, ownedEntryToWeapons } = await import('../blocks/dnd/lib/itemPlacement')
  const { normalizeValue, cloneModel, entryDisplayData, allCatalogIds } = await import('../blocks/dnd/lib/itemSection')
  const source = { ...magic, data: { ...magic.data, max_use: 7, rollback_long_rest: true, granted_spells: [{ spell: 924 }] } }
  const items = new Map([['263', source], ['49', sword]])
  const state = values(); state.weapon.push({ ...structuredClone(entry), uid: 'other' })
  const resources = collectCharacterResources(state, items)
  expect(resources).toHaveLength(2)
  const spent = { ...state, ...setCharacterResourceAvailable(state, items, resources[0].key, 0) }
  expect(spent.weapon[0].params.magic.remaining).toBe(0)
  expect(spent.weapon[1].params.magic.remaining).toBe(2)
  expect(spent.weapon[0].item_id).toBe(49)
  const stowed = { ...spent, weapon: spent.weapon.slice(1), items: appendInventoryEntry(spent.items, weaponEntryToOwnedEntry(spent.weapon[0])) }
  expect(collectCharacterResources(stowed, items)).toHaveLength(1)
  const restored = { ...stowed, ...restoreCharacterResources(stowed, items, 'long').patch }
  const bag = cloneModel(normalizeValue(restored.items)).sections[0].items[0]
  expect(bag).toMatchObject({ uid: 'blade', item_id: 49, magic_item_id: 263, params: { note: 'keep', magic: { attuned: true, remaining: 7 } } })
  expect(allCatalogIds(restored.items)).toEqual([49, 263])
  expect(entryDisplayData(bag, catalogue).name).toBe('Солнечный клинок')
  expect(ownedEntryToWeapons(bag)[0]).toMatchObject({ uid: 'blade', magic_item_id: 263, params: { magic: { remaining: 7 } } })
})
