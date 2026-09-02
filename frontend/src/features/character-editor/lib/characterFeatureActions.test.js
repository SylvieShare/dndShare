import { describe, expect, it } from 'vitest'
import { collectCharacterFeatureActions, featureActionEffectPatch, featureActionResourceKeys, groupCharacterFeatureActions } from './characterFeatureActions'

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
    expect(featureActionResourceKeys(values, items, [
      ...resources,
      { key: 'resource-unbound', source: { valueId: 'abilities_feats', entryKey: 'feat-20', resourceKey: 'other' } },
    ])).toEqual(new Set(['resource-20']))
  })

  it('can bind and spend a resource contributed by another owned feature', () => {
    const items = new Map([['20', {
      id: 20,
      name: 'Острое словцо',
      data: { feature_actions: [{
        title: 'Острое словцо',
        action_type: 'reaction',
        resource_item_id: 10,
        resource_cost: 1,
      }] },
    }]])
    const values = { lvl: { level: 3 }, abilities_class: [{ id: 20, uid: 'cutting-words' }] }
    const resource = { item_id: 10, key: 'bardic-inspiration', value: 2, total: 3, source: {} }

    expect(collectCharacterFeatureActions(values, items, [resource])[0]).toMatchObject({
      resource,
      resource_cost: 1,
    })
  })

  it('binds class actions from different features to one shared resource pool', () => {
    const items = new Map([
      ['20', {
        id: 20,
        name: 'Клятвенный враг',
        data: { feature_actions: [{
          title: 'Клятвенный враг',
          resource_pool_key: 'channel_divinity',
          resource_cost: 1,
        }] },
      }],
    ])
    const values = { lvl: { level: 3 }, abilities_class: [{ id: 20, uid: 'vow-of-enmity' }] }
    const resource = {
      key: 'classes:channel_divinity',
      pool_key: 'channel_divinity',
      value: 1,
      total: 1,
      source: { poolKey: 'channel_divinity' },
    }

    expect(collectCharacterFeatureActions(values, items, [resource])[0]).toMatchObject({
      resource,
      resource_cost: 1,
    })
  })

  it('uses the persisted per-sheet order and can include empty action groups', () => {
    const values = {
      actions: [
        { uid: 'first', title: 'Первое', action_type: 'reaction' },
        { uid: 'second', title: 'Второе', action_type: 'reaction' },
      ],
      action_order: ['manual:second', 'manual:first'],
    }
    const actions = collectCharacterFeatureActions(values, new Map())

    expect(actions.map(action => action.title)).toEqual(['Второе', 'Первое'])
    expect(groupCharacterFeatureActions(actions, true)).toHaveLength(5)
  })

  it('publishes status-gated action consequences and adjusts an exhaustion counter', () => {
    const items = new Map([
      ['30', {
        id: 30,
        name: 'Неистовство',
        data: {
          class_ids: [{ id: 1 }],
          feature_actions: [{
            key: 'frenzy_attack',
            title: 'Неистовство',
            action_type: 'bonus_action',
            level: 3,
            required_status_codes: ['rage'],
            menu_effects: [{
              key: 'gain_exhaustion',
              title: 'Получить 1 уровень истощения',
              kind: 'adjust_counter',
              value_id: 'exhaustion',
              counter_key: 'level',
              delta: 1,
              min: 0,
              max: 6,
            }],
          }],
        },
      }],
      ['100', { id: 100, name: 'Ярость', data: { code: 'rage' } }],
    ])
    const values = {
      lvl: { level: 3 },
      classes: [{ id: 1, level: 3 }],
      abilities_class: [{ id: 30, uid: 'frenzy' }],
      exhaustion: { level: 2, effects: ['Скорость уменьшена'] },
    }

    expect(collectCharacterFeatureActions(values, items)).toEqual([])

    const ragingValues = {
      ...values,
      states: [{ uid: 'rage', effect_id: 100 }],
    }
    const [action] = collectCharacterFeatureActions(ragingValues, items)
    expect(action).toMatchObject({ title: 'Неистовство', action_type: 'bonus_action' })
    expect(action.menu_effects[0]).toMatchObject({
      current: 2,
      next: 3,
      suffix: '2/6',
      disabled: false,
    })
    expect(featureActionEffectPatch(ragingValues, action.menu_effects[0])).toEqual({
      exhaustion: { level: 3, effects: ['Скорость уменьшена'] },
    })

    const [capped] = collectCharacterFeatureActions({
      ...ragingValues,
      exhaustion: { level: 6 },
    }, items)
    expect(capped.menu_effects[0]).toMatchObject({ current: 6, next: 6, disabled: true })
    expect(featureActionEffectPatch({ exhaustion: { level: 6 } }, capped.menu_effects[0])).toBeNull()
  })
})
