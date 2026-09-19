import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSpellDamageTypes } from './useSpellDamageTypes'
import { useSpellCalc } from './useSpellCalc'
import { useSpellRolls } from './useSpellRolls'
import { spellRollOptions } from '../lib/spellRollOptions'
import { useDiceStore } from '@/stores/dice'
import { rollDiceExpression } from '@/shared/lib/dice'

const suggests = ref([{ id: 5, value: 'Огнем', color: 'red' }, { id: 13, value: 'Холодом', color: 'blue' }, { id: 6, value: 'Звуком', color: 'cyan' }])
const entry = () => ({ ref: { key: 'orb-wizard' }, item: { id: 688, name: 'Цветной шарик', data: { lvl: 1, damage: {
  type_choices: [5, 13], range_attack: true, scaling: 'slot', dices: [{ count: 3, dice_id: 'd8' }], addon: [{ count: 1, dice_id: 'd8' }],
} } } })
beforeEach(() => setActivePinia(createPinia()))
function runtime(types) {
  const calc = useSpellCalc({ diceMap: ref({ d8: 'd8', d6: 'd6' }), diceDetailsMap: ref({}), damageTypeMap: ref({ 5: 'Огнем', 13: 'Холодом', 6: 'Звуком' }), damageTypeColorMap: ref({}), schoolMap: ref({}) })
  return useSpellRolls({ charCtx: {}, spellDamageTypes: types, spellcastingBlocked: ref(false), spellAttackBonus: () => 5, spellCastingAbility: () => 4, spellAbilityModifier: () => 3, charLevel: ref(5), ...calc })
}
describe('spell damage type selection', () => {
  it('requires an explicit allowed choice, keeps it across menus and isolates spell entries', () => {
    const types = useSpellDamageTypes(suggests), spell = entry()
    expect(types.ready(spell)).toBe(false)
    types.select(spell, 999); expect(types.resolve(spell)).toBeNull()
    types.select(spell, 13)
    expect(types.selected(structuredClone(spell)).value).toBe(13)
    expect(types.ready({ ...spell, ref: { key: 'orb-sorcerer' } })).toBe(false)
    const changed = structuredClone(spell); changed.item.data.damage.type_choices = [5, 6]
    expect(types.ready(changed)).toBe(false)
    expect(spell.item.data.damage.dices[0].type).toBeUndefined()
  })
  it('blocks dice before selection and records the same type on attack, upcast damage and critical dice', () => {
    const types = useSpellDamageTypes(suggests), spell = entry(), rolls = runtime(types), dice = useDiceStore()
    const attack = vi.spyOn(dice, 'rollD20').mockImplementation(() => {})
    const damage = vi.spyOn(dice, 'roll').mockImplementation(() => {})
    rolls.rollSpellAttack(spell); rolls.rollSpellDamage(spell, 3)
    expect(attack).not.toHaveBeenCalled(); expect(damage).not.toHaveBeenCalled()
    types.select(spell, 13); rolls.rollSpellAttack(spell); rolls.rollSpellDamage(structuredClone(spell), 3, true)
    expect(attack.mock.calls[0][3].eventData.damageType.id).toBe(13)
    expect(damage.mock.calls[0][1]).toBe('10d8{Холодом}')
    expect(damage.mock.calls[0][2].eventData.damageType.id).toBe(13)
    expect(damage.mock.calls[0][2].eventData.damageRoll).toBe(true)
    vi.restoreAllMocks()
  })
  it('preserves fixed damage and types both slot increments and the ability modifier', () => {
    const types = useSpellDamageTypes(suggests), spell = entry(), rolls = runtime(types)
    spell.item.data.damage.dices = [{ count: 5, dice_id: 'd6', type: 6 }, { count: 5, dice_id: 'd6' }]
    spell.item.data.damage.addon = [{ count: 1, dice_id: 'd6' }]
    types.select(spell, 5)
    expect(rolls.spellDamagePreview(spell, 2)).toBe('5d6{Звуком}+6d6{Огнем}')
    spell.item.data.damage.dices = [{ count: 2, dice_id: 'd6' }]; spell.item.data.damage.add_mod = true
    expect(rolls.spellDamagePreview(spell, 2, true)).toBe('6d6{Огнем}+3{Огнем}')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollDiceExpression(rolls.spellDamagePreview(spell, 2)).byType).toEqual([{ label: 'Огнем', color: null, value: 6 }])
    vi.restoreAllMocks()
  })
  it('inherits shared choices only for untyped damage stages and supports stage-specific choices', () => {
    const spell = entry(); spell.item.data.damage.dices = []
    spell.item.data.rolls = [
      { kind: 'damage', dices: [{ count: 2, dice_id: 'd6' }], save_ability: 'dex' },
      { kind: 'damage', dices: [{ count: 1, dice_id: 'd6', type: 6 }] },
      { kind: 'effect', dices: [{ count: 1, dice_id: 'd6' }] },
      { kind: 'damage', type_choices: [6], dices: [{ count: 1, dice_id: 'd6' }] },
    ]
    const [damage, fixed, other, own] = spellRollOptions(spell), types = useSpellDamageTypes(suggests)
    types.select(spell, 13)
    expect(types.resolve(damage.entry).item.data.damage).toMatchObject({ save_ability: 'dex', dices: [{ count: 2, dice_id: 'd6', type: 13 }] })
    expect(types.required(fixed.entry)).toBe(false); expect(types.required(other.entry)).toBe(false)
    expect(types.resolve(own.entry).damageType.id).toBe(6)
  })
})
