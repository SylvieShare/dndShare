import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { collectCharacterDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { twoWeaponFightingOption } from './twoWeaponFighting'
import { useTwoWeaponFighting } from '../composables/useTwoWeaponFighting'
import { THROW_ACTION_KEY, withWeaponThrowAction } from './weaponThrow'

const entry = { uid: 'weapon' }
const weapon = (tags, ranged = false) => ({ data: { tags, is_long_range: ranged } })
const light = weapon([{ value: 'Лёгкое' }])
const nonLightRule = { kind: 'two_weapon_non_light' }
const modifierRule = { kind: 'two_weapon_damage_modifier' }

describe('two-weapon fighting eligibility and source exceptions', () => {
  it('offers the option for light melee weapons and naturally thrown attacks', () => {
    expect(twoWeaponFightingOption(entry, light)).toMatchObject({ addAbilityModifier: false })
    const thrown = { ...entry, _attackMode: 'thrown' }
    expect(twoWeaponFightingOption(thrown, weapon(['Лёгкое', 'Метательное']))).not.toBeNull()
    expect(twoWeaponFightingOption(thrown, light)).toBeNull()
    expect(twoWeaponFightingOption({ ...entry, _improvisedThrow: true }, light)).toBeNull()
  })

  it('requires a source exception for non-light melee weapons and always excludes two-handed weapons', () => {
    const longsword = weapon(['Универсальное'])
    expect(twoWeaponFightingOption(entry, longsword)).toBeNull()
    expect(twoWeaponFightingOption(entry, longsword, [], [nonLightRule])).not.toBeNull()
    expect(twoWeaponFightingOption(entry, weapon(['Двуручное']), [], [nonLightRule])).toBeNull()
    expect(twoWeaponFightingOption(entry, weapon(['Light', 'Two-Handed']))).toBeNull()
    expect(twoWeaponFightingOption({ ...entry, params: { creation: { expired: true } } }, light)).toBeNull()
    expect(twoWeaponFightingOption(entry, null)).toBeNull()
  })

  it('allows a light ranged weapon only under 2024 rules', () => {
    const crossbow = weapon(['Лёгкое'], true)
    expect(twoWeaponFightingOption(entry, crossbow)).toBeNull()
    expect(twoWeaponFightingOption(entry, crossbow, [], [], '2024')).not.toBeNull()
    expect(twoWeaponFightingOption(entry, weapon([], true), [], [nonLightRule], '2024')).toBeNull()
  })

  it('uses only the selected fighting style, respecting level and inactive feats', () => {
    const sources = new Map([
      ['1', { name: 'Выбор стиля', data: { class_ids: [{ id: 10 }], derived_effects: [
        { ...modifierRule, level: 2, choice_key: 'style', choice_values: ['two_weapon'] },
      ] } }],
      ['2', { name: 'Сражение двумя оружиями', data: { derived_effects: [modifierRule] } }],
      ['3', { name: 'Мастер парного оружия', data: { derived_effects: [nonLightRule] } }],
    ])
    const state = (level, choice) => ({ classes: [{ id: 10, level }], abilities_class: [{ id: 1, choices: { style: [choice] } }] })
    for (const values of [state(1, 'two_weapon'), state(2, 'archery')]) {
      expect(twoWeaponFightingOption(entry, light, [], collectCharacterDerivedEffects(values, sources)).addAbilityModifier).toBe(false)
    }
    expect(twoWeaponFightingOption(entry, light, [], collectCharacterDerivedEffects(state(2, 'two_weapon'), sources)).addAbilityModifier).toBe(true)
    const feats = active => ({ lvl: { level: 4 }, abilities_feats: [{ id: 2, requirements_met: active }, { id: 3, requirements_met: active }] })
    expect(twoWeaponFightingOption(entry, light, [], collectCharacterDerivedEffects(feats(true), sources)).addAbilityModifier).toBe(true)
    expect(twoWeaponFightingOption(entry, weapon([]), [], collectCharacterDerivedEffects(feats(false), sources))).toBeNull()
  })

  it('checks selected menu modes and prepared roll modes without resetting thrown state', () => {
    const item = weapon(['Лёгкое'])
    const option = useTwoWeaponFighting({ rulesVersion: ref('2014'), characterDerivedEffects: { effects: ref([]) } },
      { item: () => item, propertyItems: () => [], actions: () => withWeaponThrowAction([], item) })
    expect(option(entry, { actionKeys: [] })).not.toBeNull()
    expect(option(entry, { actionKeys: [THROW_ACTION_KEY] })).toBeNull()
    expect(option({ ...entry, _attackMode: 'thrown', _improvisedThrow: true })).toBeNull()
    item.data.tags.push('Метательное')
    expect(option(entry, { actionKeys: [THROW_ACTION_KEY] })).not.toBeNull()
    expect(option({ ...entry, _attackMode: 'thrown' })).not.toBeNull()
  })

  it('hides the option when using already paid hit damage', () => {
    const option = useTwoWeaponFighting({}, { item: () => light, propertyItems: () => [],
      actions: () => [{ key: 'paid', prepaid: { expression: '1d4+4' } }] })
    expect(option(entry, { actionKeys: ['paid'] })).toBeNull()
  })
})
