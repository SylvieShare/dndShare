import { expect, it } from 'vitest'
import { buildLevelUpUpdates } from './buildLevelUpUpdates'
import { resolveNumValue } from '@/shared/lib/dnd'

it.each([
  ['general', 19, 20], ['general', 20, 20], ['general', 24, 24],
  ['epic_boon', 20, 21], ['epic_boon', 29, 30], ['epic_boon', 30, 30],
])('caps %s feat increases from %i at %i', (category, before, expected) => {
  const values = { lvl: { level: 18 }, hp: { max: 100, current: 80 },
    STR: { value: { base: before, bonuses: [] } }, abilities_feats: [] }
  const featPick = { id: 100, name: 'Дар', data: { category,
    choices: [{ key: 'ability', source: 'inline', count: 1,
      options: [{ value: 1, label: 'Сила' }], ability_bonus: 1 }],
  }, selectedChoices: { ability: [1] } }
  const updates = buildLevelUpUpdates({
    values, newTotal: 19, isPlain: false, entriesAfter: [{ id: 1, level: 19 }],
    features: [], itemsById: { 1: {} }, hitDieLabelOf: () => 'd8', hitDieLabel: 'd8', hpGain: 5,
    asiNow: true, asiSkipped: false, asiMode: 'feat', featPick,
    suggestItems: () => [], asiStats: [], asiDelta: 0, featureChoiceSelections: {},
    slotChanges: [], grantedNewIds: [], classItem: { id: 1, data: {} },
  })
  expect(resolveNumValue(updates.STR?.value ?? values.STR.value)).toBe(expected)
  expect(updates.abilities_feats[0]).toMatchObject({ id: 100, choices: { ability: [1] } })
  expect(values.STR.value).toEqual({ base: before, bonuses: [] })
})
