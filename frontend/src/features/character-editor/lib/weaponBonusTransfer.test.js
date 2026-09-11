import { expect, it } from 'vitest'
import { ref } from 'vue'
import { setWeaponBonusTransfer, weaponBonusTransfer } from './weaponBonusTransfer'
import { intrinsicWeaponBonus } from './magicWeapons'
import { collectCharacterDerivedEffects, derivedArmorRules } from './characterDerivedEffects'
import { deriveEquippedArmor } from '../blocks/dnd/lib/equippedArmor'
import { useWeaponCalc } from '../blocks/dnd/composables/useWeaponCalc'
import { collectCharacterResources } from './characterResources'
const item = { id: 233, typeId: 19, name: 'Защитник', data: { weapon: { magic_bonus: 3 }, weapon_bonus_transfer: { title: 'Перенести в защиту' }, attunement: 'required', activation: 'equipped' } }
const items = new Map([['233', item]])
const make = () => ({ lvl: { level: 5 }, DEX: { value: 14 }, weapon: ['one', 'two'].map(uid => ({ uid, item_id: 49, magic_item_id: 233, params: { magic: { attuned: true, remaining: 7 }, note: 'keep' } })) })
const armor = values => deriveEquippedArmor(values, items, () => [], derivedArmorRules(collectCharacterDerivedEffects(values, items)))
it('links AC, attack, damage and critical modifiers to one instance without charges', () => {
 const values = make()
 const patch = setWeaponBonusTransfer(values, items, 'one', 2, true)
 const next = { ...values, ...patch }, row = next.weapon[0]
 expect(values.weapon[0].params.magic.bonus_transfer).toBeUndefined()
 expect(row.params).toMatchObject({ magic: { bonus_transfer: 2, remaining: 7, attuned: true }, note: 'keep' })
 expect(intrinsicWeaponBonus(row, item, next)).toBe(1)
 expect(intrinsicWeaponBonus(next.weapon[1], item, next)).toBe(3)
 expect(collectCharacterResources(next, items)).toEqual([])
 expect(armor(next).total - armor(values).total).toBe(2)
 const calc = useWeaponCalc({ statsVar: ref({ 1: 3 }), profBonus: ref(2), diceMap: ref({ d8: 'd8' }), diceDetailsMap: ref({}), damageTypeMap: ref({}), damageTypeDetailsMap: ref({}), item: () => item, propertyItems: () => [], itemBaseAttacks: () => [{ count: 1, dice_id: 'd8', type: 2 }], isProficient: () => true, magicBonusModifier: entry => intrinsicWeaponBonus(entry, item, next) })
 expect(calc.attackBonus(row)).toBe(6)
 expect(calc.damageExpression(row)).toBe('1d8{2}+4{2}')
 expect(calc.criticalDamageExpression(row)).toBe('2d8{2}+4{2}')
 const restored = { ...next, ...setWeaponBonusTransfer(next, items, 'one', 0, true) }
 expect(intrinsicWeaponBonus(restored.weapon[0], item, restored)).toBe(3)
 expect(armor(restored).total).toBe(armor(values).total)
})
it('survives reload, suppresses inactive AC, and allows reset while stowed', () => {
 let values = make(); values = JSON.parse(JSON.stringify({ ...values, ...setWeaponBonusTransfer(values, items, 'one', 3, true) }))
 const row = values.weapon.shift()
 values.items = { sections: [{ items: [row] }] }
 expect(derivedArmorRules(collectCharacterDerivedEffects(values, items)).bonuses).toEqual([])
 expect(setWeaponBonusTransfer(values, items, 'one', 2, true)).toEqual({})
 const reset = setWeaponBonusTransfer(values, items, 'one', 0, true)
 expect(reset.items.sections[0].items[0].params.magic.bonus_transfer).toBe(0)
 values.items = { equipped: [row] }
 expect(derivedArmorRules(collectCharacterDerivedEffects(values, items)).bonuses[0].value).toBe(3)
 for (const state of [{ attuned: false }, { lost: true }]) {
  Object.assign(row.params.magic, state)
  expect(derivedArmorRules(collectCharacterDerivedEffects(values, items)).bonuses).toEqual([])
 }
})
it('rejects unauthorized and invalid amounts; clamps persisted state after a source edit', () => {
 const values = make()
 for (const amount of [-1, 4, 1.5, NaN, Infinity]) expect(setWeaponBonusTransfer(values, items, 'one', amount, true)).toEqual({})
 expect(setWeaponBonusTransfer(values, items, 'one', 1, false)).toEqual({})
 values.weapon[0].params.magic.bonus_transfer = 3
 const changed = { ...item, data: { ...item.data, weapon: { magic_bonus: 1 } } }
 expect(weaponBonusTransfer(values.weapon[0], changed, values).value).toBe(1)
 values.weapon[0].params.magic.attuned = false
 const noAttunementBonus = { ...item, data: { ...item.data, weapon: { magic_bonus: 3, bonus_without_attunement: true } } }
 expect(intrinsicWeaponBonus(values.weapon[0], noAttunementBonus, values)).toBe(3)
})
