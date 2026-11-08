import { describe, expect, it } from 'vitest'
import fixtures from '../../../native/fixtures/game-mechanics/effect-bindings.json'
import schema from '../../../resources/items/item_5_shema.json'
import abilitySchema from '../../../resources/items/item_4_shema.json'
import { effectParameterOptions, setEffectParameter } from '@/features/items/editor/effectParameterOptions'
import { effectBindingError, effectBindingSources } from '@/features/items/editor/effectBindingFields'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { collectCharacterDerivedEffects, derivedNumericBonus } from '@/features/character-editor/lib/characterDerivedEffects'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from '@/features/character-editor/lib/characterCombatEffects'

const linkField = schema.find(field => field.key === 'status_effects')
const bindingFields = linkField.fields.find(field => field.key === 'parameter_bindings').fields
const sources = effectBindingSources(bindingFields, false)

describe('authoring and receiving effect parameters', () => {
  it('distinguishes separate damage parameters by their rule names', () => {
    const parameters = effectParameterOptions({ data: { weapon_damage: [
      { label: 'Огонь', dice_count_parameter: 'fire_dice' },
      { label: 'Холод', dice_count_parameter: 'cold_dice' },
    ] } })
    expect(parameters.map(row => row.label)).toEqual(['Число костей урона · Огонь', 'Число костей урона · Холод'])
  })
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const parameter = effectParameterOptions(fixture.effect).find(row => row.key === fixture.binding.key)
      expect(parameter).toBeDefined()
      expect(parameter.label).not.toBe(fixture.binding.key)
      const link = { key: 'enchant', effect: fixture.effect.id, target: 'self' }
      setEffectParameter(link, parameter.key, fixture.binding.source, fixture.binding)
      const saved = normalizeDataForSave({ status_effects: [link] }, [linkField])
      const reopened = JSON.parse(JSON.stringify(saved))
      expect(reopened.status_effects[0].effect).toEqual({ id: fixture.effect.id })
      expect(reopened.status_effects[0].parameter_bindings).toEqual([fixture.binding])
      expect(effectBindingError(fixture.binding, sources)).toBe('')

      for (const cast of fixture.casts) {
        const values = { lvl: { level: 1 }, INT: { value: 6 }, states: [{
          uid: 'applied', effect_id: fixture.effect.id,
          params: { [fixture.binding.key]: cast.want, weapon_uid: 'sword' },
        }] }
        const items = new Map([[String(fixture.effect.id), fixture.effect]])
        const effects = collectCharacterDerivedEffects(values, items)
        expect(derivedNumericBonus(effects, 'weapon_attack_bonus', values, { targetId: 'sword' }).total).toBe(fixture.attack ? cast.want : 0)
        expect(derivedNumericBonus(effects, 'weapon_attack_bonus', values, { targetId: 'other' }).total).toBe(0)
        const combat = collectCharacterCombatEffects(values, items)
        const damage = matchingWeaponDamageActions(combat, { weaponUid: 'sword', melee: true })
        expect(damage.map(rule => `${rule.dice_count}${rule.dice}`)).toEqual(cast.want > 0 ? [`${cast.want}${fixture.die}`] : [])
        expect(matchingWeaponDamageActions(combat, { weaponUid: 'other', melee: true })).toEqual([])
      }
    })
  }

  it('preserves zero and unrelated bindings when editing a coefficient, then removes inactive settings on a source change', () => {
    const data = { parameter_bindings: [
      { key: 'other', source: 'fixed', value: 4 },
      { key: 'bonus', source: 'slot_increase', value: 1, step: 2, maximum: 3 },
    ] }
    setEffectParameter(data, 'bonus', 'slot_increase', { multiplier: 0 })
    expect(data.parameter_bindings[1]).toEqual({ key: 'bonus', source: 'slot_increase', value: 1, step: 2, multiplier: 0, maximum: 3 })
    setEffectParameter(data, 'bonus', 'cast_level')
    expect(data.parameter_bindings[1]).toMatchObject({ source: 'cast_level', step: 2, multiplier: 0, maximum: 3 })
    setEffectParameter(data, 'bonus', 'fixed')
    expect(data.parameter_bindings).toEqual([{ key: 'other', source: 'fixed', value: 4 }, { key: 'bonus', source: 'fixed', value: 1 }])
    setEffectParameter(data, 'bonus', 'scaling_value')
    expect(data.parameter_bindings[1]).toEqual({ key: 'bonus', source: 'scaling_value' })
  })

  it('rejects invalid calculations and offers progression only to supported sources', () => {
    expect(sources.map(row => row.value)).toEqual(['fixed', 'slot_increase', 'cast_level', 'casting_modifier'])
    const abilityFields = abilitySchema.find(field => field.key === 'status_effects').fields.find(field => field.key === 'parameter_bindings').fields
    expect(effectBindingSources(abilityFields, true).map(row => row.value)).toEqual(['scaling_value', 'fixed'])
    for (const patch of [{ step: 0 }, { step: -1 }, { value: 1.5 }, { multiplier: Infinity }, { minimum: 5, maximum: 3 }]) {
      expect(effectBindingError({ source: 'slot_increase', ...patch }, sources)).not.toBe('')
    }
  })
})
