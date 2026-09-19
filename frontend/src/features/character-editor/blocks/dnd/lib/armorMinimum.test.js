import { describe, expect, it } from 'vitest'
import { deriveEquippedArmor } from './equippedArmor'
import { derivedArmorRules } from '@/features/character-editor/lib/characterDerivedEffects'
import { useEncounterNpcData } from '@/features/sessions/composables/useEncounterNpcData'
import { targetArmorClass } from '@/features/sessions/lib/loadSessionTargets'

const floor = { kind: 'armor_minimum', value: 16, source_label: 'Дубовая кора' }
const bonus = { kind: 'armor_bonus', value: 2 }
const shield = { id: 1, typeId: 12, data: { category: 'shield', armor: { shield: true, shield_bonus: 2 } } }
const equipment = { equipped: [{ uid: 'shield', item_id: 1, count: 1 }] }

describe('minimum final armor class', () => {
  it('takes the maximum after shields and bonuses, without stacking floors', () => {
    const values = { DEX: { value: 10 }, items: equipment }
    const rules = derivedArmorRules([floor, { ...floor, value: 14 }, bonus])
    expect(deriveEquippedArmor(values, { 1: shield }, () => [], rules)).toMatchObject({ total: 16, minimum: floor })
    expect(deriveEquippedArmor({ ...values, DEX: { value: 20 } }, { 1: shield }, () => [], rules).total).toBe(19)
    expect(deriveEquippedArmor(values, { 1: shield }, () => [], derivedArmorRules([bonus])).total).toBe(14)
  })

  it('evaluates equipment conditions after collecting rules', () => {
    const body = { id: 2, typeId: 12, data: { category: 'heavy', armor: { ac: 12, use_dex: false } } }
    const rules = derivedArmorRules([{ ...bonus, requires_armor: true }, { ...floor, requires_no_armor: true }])
    const result = deriveEquippedArmor({ items: { equipped: [{ uid: 'armor', item_id: 2 }] } }, { 2: body }, () => [], rules)
    expect(result).toMatchObject({ total: 14, minimum: null })
    expect(deriveEquippedArmor({}, {}, () => [], rules).total).toBe(16)
  })

  it('uses the same active effect and override in the NPC card and target chooser', () => {
    const creature = { id: 3, name: 'Существо', data: { combat: { ac: 11 } } }
    const effect = { id: 4, name: 'Защита', data: { derived_effects: [floor, bonus] } }
    const npc = { uid: 'npc', type: 'npc', itemId: 3, effectInstances: [{ uid: 'effect', effect_id: 4 }] }
    const state = useEncounterNpcData()
    state.cacheItem(creature); state.cacheItem(effect)
    const targetAc = c => targetArmorClass({ kind: 'npc', snapshot: { item: creature.data, combatant: c } }, new Map([['4', effect]]))
    expect(state.npcAc(npc)).toBe(16)
    expect(targetAc(npc)).toBe(16)
    expect(targetAc({ ...npc, override: { ac: 20 } })).toBe(22)
    expect(state.npcAc({ ...npc, override: { ac: 20 } })).toBe(22)
    expect(targetAc({ ...npc, effectInstances: [] })).toBe(11)
  })
})
