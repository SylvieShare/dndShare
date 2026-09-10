import { describe, expect, it } from 'vitest'
import { computed, effectScope, reactive } from 'vue'
import { abilityEditorProfile } from './abilityEditorProfile'
import { useAbilityDependencies } from './useAbilityDependencies'
import { mechanicFields, updateMechanic } from './abilityMechanicManifest'
import { effectParameterOptions, setEffectParameter } from './effectParameterOptions'
import { automaticAbilityLabel, progressionError, weaponDamageDiceCount } from '@/shared/lib/abilityProgression'
import { abilityScalingLabel } from '@/shared/lib/dndAbilityUses'
import { classProgression } from '@/features/items/lib/classProgression'
import schema from '../../../../../resources/items/item_4_shema.json'

describe('readable ability mechanics', () => {
  it('groups progression rows in one dependency without changing the saved arrays', () => {
    const scope = effectScope()
    const data = reactive({ scaling: [{ level: 1, value: '+2' }, { level: 9, value: '+3' }], display_scaling: [{ level: 1, label: 'Бонус' }] })
    const editor = scope.run(() => useAbilityDependencies(computed(() => abilityEditorProfile(schema, 4)), data))
    expect(editor.entries.value.map(card => card.key)).toEqual(['progression'])
    expect(data.scaling).toHaveLength(2)
    editor.remove(editor.entries.value[0])
    expect(data.scaling).toBeUndefined()
    expect(data.display_scaling).toBeUndefined()
    scope.stop()
  })
  it('derives Sneak Attack dice at every level and uses the owner class in a multiclass sheet', () => {
    const rule = { dice: 'd6', dice_count_level_divisor: 2, dice_count_rounding: 'up' }
    const data = { class_ids: [{ id: 1 }], weapon_damage: [rule] }
    for (let level = 1; level <= 20; level++) {
      expect(weaponDamageDiceCount(rule, level)).toBe(Math.ceil(level / 2))
      expect(automaticAbilityLabel(data, level)).toBe(`${Math.ceil(level / 2)}к6`)
    }
    expect(abilityScalingLabel(data, { lvl: { level: 12 }, classes: [{ id: 1, level: 3 }, { id: 2, level: 9 }] })).toBe('2к6')
    expect(abilityScalingLabel({ ...data, display_scaling: [{ level: 1, label: 'Своя подпись' }] }, { lvl: { level: 4 } })).toBe('Своя подпись')
  })
  it('keeps the class roadmap after redundant Sneak Attack tables are removed', () => {
    const feature = { id: 10, name: 'Скрытая атака', data: { level: 1, class_ids: [{ id: 1 }], weapon_damage: [{ dice: 'd6', dice_count_level_divisor: 2 }] } }
    const progression = classProgression({ id: 1, data: {} }, null, [feature])
    expect(progression[2].improvements.map(row => row.text)).toEqual(['2к6'])
    expect(progression[3].improvements).toEqual([])
  })
  it('shows only relevant widget fields and removes obsolete dependent values on mode changes', () => {
    const fields = schema.find(field => field.key === 'sheet_widgets').fields
    const keys = fields.map(field => field.key)
    expect(mechanicFields('sheet_widgets', fields, keys, { kind: 'metric', value_source: 'scaling' }).map(field => field.key)).not.toContain('value')
    const data = { kind: 'toggle', value_source: 'scaling', value: 'old', status_effect_key: 'rage', active_label: 'Выйти' }
    updateMechanic('sheet_widgets', data, { ...data, kind: 'metric' })
    expect(data).toEqual({ kind: 'metric', value_source: 'scaling' })
  })
  it('names effect parameters using their actual rule labels and clears fixed values when switching to progression', () => {
    const effect = { data: { derived_effects: [{ label: 'Бонус к урону', value_parameter: 'damage_bonus' }] } }
    expect(effectParameterOptions(effect)).toEqual([{ key: 'damage_bonus', label: 'Бонус к урону' }])
    const data = { parameter_bindings: [{ key: 'damage_bonus', source: 'fixed', value: 7 }] }
    setEffectParameter(data, 'damage_bonus', 'scaling_value')
    expect(data.parameter_bindings).toEqual([{ key: 'damage_bonus', source: 'scaling_value' }])
    setEffectParameter(data, 'damage_bonus', '')
    expect(data.parameter_bindings).toEqual([])
  })
  it('rejects duplicate progression levels and invalid resource amounts', () => {
    expect(progressionError({ scaling: [{ level: 1 }, { level: '1' }] })).toContain('одинакового')
    expect(progressionError({ scaling: [{ level: 21 }] })).toContain('от 1 до 20')
    expect(progressionError({ scaling: [{ level: 20, uses: 0 }] })).toBe('')
    expect(progressionError({ scaling: [{ level: 1, uses: -1 }] })).toContain('неотрицательным')
  })
})
