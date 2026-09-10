import { describe, expect, it } from 'vitest'
import { deriveEquippedArmor } from '../blocks/dnd/lib/equippedArmor'
import { resolveMagicArmor } from './magicArmor'
import { eligibleMagicBase, magicBaseParams } from '@/features/items/lib/magicEquipmentBases'
const plate = { id: 1, typeId: 12, name: 'Латы', data: { armor: { ac: 18, use_dex: false }, category: 'heavy', required_armor_proficiency: 16, strength_required: 15, stealth_disadvantage: true } }
const shield = { id: 2, typeId: 12, name: 'Щит', data: { armor: { shield: true, shield_bonus: 2 }, category: 'shield' } }
const magic = { id: 3, typeId: 19, name: 'Мифрил', data: { attunement: 'none', armor_base: { allowed_base_item_ids: [1], magic_bonus: 1, ignore_strength: true, ignore_stealth_disadvantage: true } } }
const row = { uid: 'armor', item_id: 3, count: 1, params: { armor_base_item_id: 1 } }
const values = { lvl: { level: 1 }, STR: { value: 8 }, DEX: { value: 16 }, items: { equipped: [row] } }
const map = { 1: plate, 2: shield, 3: magic }
describe('magical armor bases', () => {
  it('inherits physical rules and applies explicit exceptions without mutating the base', () => {
    const armor = deriveEquippedArmor(values, map)
    expect(armor.total).toBe(19)
    expect(armor.speedPenalty).toBe(0)
    expect(armor.stealthDisadvantage).toBe(false)
    expect(armor.castingBlocked).toBe(true)
    expect(plate.data.strength_required).toBe(15)
    expect(plate.data.armor.ac).toBe(18)
  })
  it('requires the allowed base and respects its actual type', () => {
    expect(resolveMagicArmor(magic, { ...row, params: {} }, map)).toBeNull()
    expect(resolveMagicArmor(magic, { ...row, params: { armor_base_item_id: 2 } }, map)).toBeNull()
    expect(resolveMagicArmor(magic, row, { 1: { ...plate, typeId: 19 } })).toBeNull()
    expect(eligibleMagicBase(magic, plate, 'armor_base')).toBe(true)
    expect(eligibleMagicBase(magic, shield, 'armor_base')).toBe(false)
  })
  it('adds the magic bonus once, only after attunement, while physical armor always works', () => {
    const required = { ...magic, data: { ...magic.data, attunement: 'required' } }
    expect(deriveEquippedArmor(values, { ...map, 3: required }).total).toBe(18)
    expect(deriveEquippedArmor({ ...values, items: { equipped: [{ ...row, params: { ...row.params, magic: { attuned: true } } }] } }, { ...map, 3: required }).total).toBe(19)
    const magicShield = { id: 4, typeId: 19, data: { attunement: 'none', armor_base: { base_item_id: 2, magic_bonus: 2 } } }
    const result = deriveEquippedArmor({ ...values, items: { equipped: [row, { uid: 'shield', item_id: 4 }] } }, { ...map, 4: magicShield })
    expect(result.total).toBe(23)
  })
  it('duplicates only the base selection, never attunement or charges', () => {
    expect(magicBaseParams(magic, { ...row.params, magic: { attuned: true, remaining: 4 } })).toEqual({ armor_base_item_id: 1 })
  })
})

import { mergeEditedInstanceParams } from '@/features/items/lib/itemInstance'
it('keeps the chosen base and resource state when clearing an inline instance field', () => {
  const params = { armor_base_item_id: 1, magic: { attuned: true, remaining: 2 }, magic_bonus: 1 }
  expect(mergeEditedInstanceParams(params, {}, [{ key: 'magic_bonus', type: 'int' }])).toEqual({ armor_base_item_id: 1, magic: { attuned: true, remaining: 2 } })
})
