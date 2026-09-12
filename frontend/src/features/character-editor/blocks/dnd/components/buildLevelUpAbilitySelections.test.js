import { expect, it } from 'vitest'
import { buildLevelUpUpdates } from './buildLevelUpUpdates'

it('commits invocation replacement with grants and linked statuses, preserving remaining charges', () => {
  const parent = { id: 10, data: { class_ids: [{ id: 1 }], level: 2, ability_selection: { counts: [{ level: 2, count: 2 }], replace_count: 1 } } }
  const old = { id: 11, data: { selection_parent_id: 10, granted_spells: [{ spell: { id: 50 }, slotless: true }] } }
  const kept = { id: 12, data: { selection_parent_id: 10, max_use: 1 } }
  const added = { id: 13, data: { selection_parent_id: 10, granted_spells: [{ spell: { id: 51 }, slotless: true }] } }
  const values = { lvl: { level: 2 }, classes: [{ id: 1, level: 2 }], hp: { max: 12, current: 7 },
    abilities_class: [{ id: 10 }, { id: 11, selection_source: 10 }, { id: 12, selection_source: 10, uid: 'kept', count: 0 }],
    states: [{ id: 20, source: { kind: 'feature_action', item_id: 11 } }, { id: 21, source: { kind: 'manual' } }],
    spells: { grants: [{ id: 50, source: { kind: 'ability', item_id: 11 } }, { id: 52, source: { kind: 'manual' } }] },
  }
  const params = { values, newTotal: 3, entriesAfter: [{ id: 1, level: 3 }], classItem: { id: 1 }, features: [],
    itemsById: { 1: {}, 10: parent, 11: old, 12: kept, 13: added }, hitDieLabelOf: () => 'd8', hpGain: 5,
    featureChoiceSelections: {}, grantedNewIds: [], abilitySelections: [{ parent, entries: [{ id: 12 }, { id: 13 }] }],
  }
  const patch = buildLevelUpUpdates(params)
  expect(patch.abilities_class.map(entry => entry.id)).toEqual([10, 12, 13])
  expect(patch.abilities_class[1]).toMatchObject({ uid: 'kept', count: 0 })
  expect(patch.states).toEqual([values.states[1]])
  expect(patch.spells.grants.map(entry => entry.id).sort()).toEqual([51, 52])
  expect(values.abilities_class.map(entry => entry.id)).toEqual([10, 11, 12])
  expect(() => buildLevelUpUpdates({ ...params, abilitySelections: [{ parent, entries: [{ id: 13 }] }] })).toThrow('Выбрано 1 из 2')
})
