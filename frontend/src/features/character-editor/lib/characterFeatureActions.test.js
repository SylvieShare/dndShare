import { describe, expect, it } from 'vitest'
import { collectCharacterFeatureActions, groupCharacterFeatureActions } from './characterFeatureActions'

describe('character feature actions', () => {
  it('merges manual and level-gated source actions with readonly provenance', () => {
    const items = new Map([['10', {
      id: 10,
      name: 'Хитрое действие',
      data: {
        class_ids: [{ id: 4 }],
        feature_actions: [
          { key: 'dash', title: 'Рывок', action_type: 'bonus_action', level: 2 },
          { key: 'late', title: 'Позднее действие', action_type: 'reaction', level: 6 },
        ],
      },
    }]])
    const values = {
      lvl: { level: 3 },
      classes: [{ id: 4, level: 3 }],
      abilities_class: [{ id: 10, uid: 'owned-10' }],
      actions: [{ uid: 'manual-1', title: 'Бросить песок', action_type: 'action', requirements: ['Свободная рука'] }],
    }

    const actions = collectCharacterFeatureActions(values, items)

    expect(actions).toHaveLength(2)
    expect(actions[0]).toMatchObject({ title: 'Бросить песок', readonly: false })
    expect(actions[1]).toMatchObject({ title: 'Рывок', readonly: true, source_label: 'Хитрое действие' })
    expect(groupCharacterFeatureActions(actions).map(group => group.value)).toEqual(['action', 'bonus_action'])
  })

  it('binds an action only to the named resource of its owning ability', () => {
    const items = new Map([['20', {
      id: 20,
      name: 'Приём',
      data: { feature_actions: [{ title: 'Использовать приём', resource_key: 'dice', resource_cost: 1 }] },
    }]])
    const values = { lvl: { level: 1 }, abilities_feats: [{ id: 20, uid: 'feat-20' }] }
    const resources = [{ key: 'resource-20', source: { valueId: 'abilities_feats', entryKey: 'feat-20', resourceKey: 'dice' }, value: 2, total: 3 }]

    expect(collectCharacterFeatureActions(values, items, resources)[0].resource).toBe(resources[0])
  })
})
