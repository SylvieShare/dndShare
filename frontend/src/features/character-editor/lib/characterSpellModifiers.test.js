import { describe, expect, it } from 'vitest'
import { collectCharacterSpellModifiers } from './characterSpellModifiers'
import { useSpellCalc } from '../blocks/dnd/composables/useSpellCalc'
const item = { id: 1, data: { level: 2, class_ids: [{ id: 10 }], spell_modifiers: [{ spell_id: 500, damage_ability: 6 }, { spell_id: 500, range: '300 футов' }] } }
const map = new Map([['1',item]])
const spell = { id: 500, data: { lvl: 0, range: '120 футов', damage: { dices: [{ dice_id: 'd10', count: 1 }], scaling: 'cantrip', instances: 1, addon_instances: 1 } } }
it('adds Charisma once per beam, permits negative modifiers, and leaves unrelated spells unchanged', () => {
  for (const [score, expected] of [[16,3],[8,-1]]) {
    const values = { lvl: { level: 5 }, classes: [{ id: 10, level: 5 }], CHA: { value: score }, abilities_class: [{ id: 1 }] }
    const modifiers = collectCharacterSpellModifiers(values, map)
    const calc = useSpellCalc({ diceMap: { value: { d10: 'к10' } }, diceDetailsMap: { value: {} }, damageTypeMap: { value: {} }, schoolMap: { value: {} }, spellModifiers: { value: modifiers } })
    expect(calc.damageDiceParts(spell, 0, 17)[0]).toMatchObject({ count: 1, bonus: expected })
    expect(calc.damageDiceParts({ ...spell, id: 501 })[0].bonus).toBe(0)
    expect(calc.spellMetaLine(spell)).toBe('300 футов')
    expect(collectCharacterSpellModifiers({ ...values, abilities_class: [] }, map)).toEqual([])
  }
})
