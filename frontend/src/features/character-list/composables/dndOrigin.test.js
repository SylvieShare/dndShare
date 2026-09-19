import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { useDndOrigin } from './useDndOrigin'
import { buildCharacterData } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { evaluateFeatEligibility } from '@/features/items/lib/featRules'

describe('2024 origins', () => {
  const race = { id: 1, name: 'Вид', item: { data: { asi: [{ ability: 1, bonus: 2 }] } } }
  const background = { id: 2, name: 'Предыстория', item: { data: { ability_options: [1, 2, 3] } } }
  const feat = { id: 3, data: { category: 'origin' } }
  it('replaces racial ASI with background choices and grants the exact origin feat', () => {
    const result = buildCharacterData({ rulesVersion: '2024', race, background, backgroundAsi: { STR: 2, CON: 1 }, originFeat: feat, scores: { STR: 15, CON: 12 } })
    expect(result.data.values.STR.value).toMatchObject({ base: 15, bonuses: [{ value: 2, name: 'Предыстория' }] })
    expect(result.data.values.CON.value.bonuses[0].value).toBe(1)
    expect(result.data.values.abilities_feats.map(row => row.id)).toEqual([3])
  })
  it('rejects a general feat and incomplete origin choices', () => {
    const state = reactive({ version: '2024', background: { data: { ability_options: [1, 2, 3] } }, backgroundAsi: { STR: 2, CON: 1 }, originFeatId: 3, originFeatChoices: {} })
    const pool = ref([{ ...feat, data: { category: 'general' } }])
    const origin = useDndOrigin(state, pool)
    expect(origin.originComplete.value).toBe(false)
    pool.value = [feat]
    expect(origin.originComplete.value).toBe(true)
    state.backgroundAsi = { STR: 2, WIS: 1 }
    expect(origin.originComplete.value).toBe(false)
    expect(evaluateFeatEligibility({ data: { category: 'epic_boon' } }, { level: 18 }).eligible).toBe(false)
  })
})

it('keeps background Magic Initiate class fixed and preserves two different repeatable grants', () => {
  const feat = { id: 3, data: { category: 'origin', repeatable: true, choices: [{ key: 'magic_class', source: 'inline', count: 1, options: [{ value: 4 }, { value: 5 }] }] } }
  const state = reactive({ version: '2024', background: { data: { ability_options: [1, 2, 3], origin_feat_id: 3, origin_feat_class_id: 4 } }, backgroundAsi: { STR: 2, CON: 1 }, originFeatChoices: { magic_class: [4] }, featIds: [3], featSelections: { 3: { magic_class: [5] } } })
  const origin = useDndOrigin(state, ref([feat]))
  expect(origin.originFeat.value.data.choices[0].options).toEqual([{ value: 4 }])
  expect(origin.originComplete.value).toBe(true)
  state.featSelections[3].magic_class = [4]
  expect(origin.originComplete.value).toBe(false)
  const result = buildCharacterData({ rulesVersion: '2024', originFeat: feat, originFeatChoices: { magic_class: [4] }, feats: [{ item: feat, choices: { magic_class: [5] } }] })
  expect(result.data.values.abilities_feats.map(row => row.choices.magic_class)).toEqual([[5], [4]])
  expect(new Set(result.data.values.abilities_feats.map(row => row.uid)).size).toBe(2)
})
