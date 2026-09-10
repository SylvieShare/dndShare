import { describe, expect, it } from 'vitest'
import { equippedMagicWeapons, intrinsicWeaponBonus, resolveMagicWeapon, saveMagicWeaponRows, weaponBaseId } from './magicWeapons'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { collectCharacterDerivedEffects, derivedNumericBonus } from './characterDerivedEffects'
import { useWeaponCalc } from '../blocks/dnd/composables/useWeaponCalc'
import { ref } from 'vue'

const sword = { id: 49, typeId: 1, name: 'Меч', data: { attacks: [{ count: 1, dice_id: 'd8', type: 2 }], tags: [10], required_weapon_proficiencies: [27, 16], universe_attacks: [{ count: 1, dice_id: 'd10', type: 2 }] } }
const magic = { id: 263, typeId: 19, name: 'Солнечный клинок', data: { weapon: { base_item_id: 49, magic_bonus: 2, damage_type: 7, extra_tags: [11], extra_proficiencies: [17] }, attunement: 'required', activation: 'equipped' } }
const entry = { uid: 'blade', item_id: 263, count: 1, params: { magic: { attuned: true, remaining: 2 }, note: 'keep' } }
const values = () => ({ lvl: { level: 7 }, items: { equipped: [structuredClone(entry)], sections: [] } })
const catalogue = { 49: sword, 263: magic }

describe('magic weapon inventory projection', () => {
  it('resolves physical properties without changing the catalogue or duplicating the item', () => {
    const state = values(), rows = equippedMagicWeapons(state, catalogue)
    expect(rows).toHaveLength(1)
    const weapon = resolveMagicWeapon(magic, rows[0], catalogue)
    expect(weapon).toMatchObject({ id: 263, typeId: 19, data: { attacks: [{ dice_id: 'd8', type: 7 }], universe_attacks: [{ dice_id: 'd10', type: 7 }], tags: [10, 11], required_weapon_proficiencies: [27, 16, 17] } })
    expect(sword.data.attacks[0].type).toBe(2)
    expect(state.weapon).toBeUndefined()
    state.items.sections.push({ items: state.items.equipped }); state.items.equipped = []
    expect(equippedMagicWeapons(state, catalogue)).toEqual([])
  })
  it('requires a valid per-instance choice for variable weapons', () => {
    const item = { ...magic, data: { weapon: { allowed_base_item_ids: [49] } } }
    expect(weaponBaseId(item, entry)).toBeNull()
    expect(weaponBaseId(item, { params: { weapon_base_item_id: 36 } })).toBeNull()
    expect(weaponBaseId(item, { params: { weapon_base_item_id: 49 } })).toBe(49)
    expect(resolveMagicWeapon(item, { params: { weapon_base_item_id: 49 } }, { 49: { ...sword, typeId: 2 } })).toBeNull()
  })
  it('preserves charges, attunement and another copy while editing attack settings', () => {
    const state = values(); state.items.equipped.push({ ...entry, uid: 'other' })
    const rows = equippedMagicWeapons(state, catalogue)
    rows[0] = { ...rows[0], stat_suggest_id: 2, desc: 'my note', params: { ...rows[0].params, magic_bonus: 1 } }
    const updated = saveMagicWeaponRows(state.items, rows.slice(0, 1))
    expect(updated.equipped[0]).toMatchObject({ uid: 'blade', count: 1, params: { note: 'keep', magic: { attuned: true, remaining: 2 }, magic_bonus: 1, _weapon_state: { stat_suggest_id: 2, desc: 'my note' } } })
    expect(updated.equipped[1]).toEqual(state.items.equipped[1])
  })
  it('gates the built-in bonus by attunement and adds it once to attack and critical damage', () => {
    const state = values(), row = equippedMagicWeapons(state, catalogue)[0]
    expect(intrinsicWeaponBonus(row, magic, state)).toBe(2)
    row.params.magic.attuned = false
    expect(intrinsicWeaponBonus(row, magic, state)).toBe(0)
    expect(intrinsicWeaponBonus(row, { ...magic, data: { ...magic.data, weapon: { ...magic.data.weapon, bonus_without_attunement: true } } }, state)).toBe(2)
    row.params.magic.attuned = true
    const resolved = resolveMagicWeapon(magic, row, catalogue)
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
