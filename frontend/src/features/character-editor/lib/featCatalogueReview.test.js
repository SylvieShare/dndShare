import { describe, expect, it } from 'vitest'
import combat from '../../../../../md/data/feat-review/2014-batch-01.json'
import foundations from '../../../../../md/data/feat-review/2014-batch-02.json'
import utility from '../../../../../md/data/feat-review/2014-batch-03.json'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterDerivedEffects, derivedNumericBonus } from './characterDerivedEffects'
import { evaluateFeatEligibility } from '@/features/items/lib/featRules'

function itemFromReview(spec) {
  return { id: spec.id, typeId: 7, name: spec.name,
    data: Object.fromEntries(Object.entries(spec.fields).map(([key, change]) => [key, change.after])) }
}

describe('reviewed feat catalogue on the character sheet', () => {
  it('exposes the two distinct Shield Master actions without an unconditional Dexterity bonus', () => {
    const item = itemFromReview(combat.find(spec => spec.id === 4340))
    const values = { lvl: { level: 5 }, abilities_feats: [{ id: item.id }] }
    const items = new Map([[String(item.id), item]])
    const actions = collectCharacterFeatureActions(values, items)
    expect(actions.map(action => [action.title, action.action_type])).toEqual([
      ['Толчок щитом', 'bonus_action'], ['Выставить щит', 'reaction'],
    ])
    expect(actions[0].requirements.join(' ')).toContain('уже совершили действие Атака')
    expect(derivedNumericBonus(collectCharacterDerivedEffects(values, items), 'save_bonus', values,
      { kind: 'saving_throw', abilitySuggestId: 2 }).total).toBe(0)
  })

  it('keeps opportunity reactions separate from bonus attacks for Polearm Master', () => {
    const item = itemFromReview(combat.find(spec => spec.id === 4338))
    const actions = collectCharacterFeatureActions({ lvl: { level: 1 }, abilities_feats: [{ id: item.id }] },
      new Map([[String(item.id), item]]))
    expect(actions.map(action => action.action_type)).toEqual(['bonus_action', 'reaction'])
    expect(actions[0].requirements.join(' ')).not.toContain('пику')
    expect(actions[1].requirements.join(' ')).toContain('пику')
  })

  it('binds the Lucky action to its own pool rather than another feat resource', () => {
    const item = itemFromReview(foundations.find(spec => spec.id === 4324))
    const resource = { key: 'luck', value: 3, total: 3,
      source: { valueId: 'abilities_feats', entryKey: '4324' } }
    const actions = collectCharacterFeatureActions({ lvl: { level: 3 }, abilities_feats: [{ id: 4324 }] },
      new Map([['4324', item]]), [resource])
    expect(actions[0]).toMatchObject({ resource, resource_cost: 1, action_type: 'special' })
  })

  it('enforces the restored Skulker prerequisite', () => {
    const item = itemFromReview(utility.find(spec => spec.id === 4589))
    expect(evaluateFeatEligibility(item, { stats: { DEX: 12 } }).eligible).toBe(false)
    expect(evaluateFeatEligibility(item, { stats: { DEX: 13 } }).eligible).toBe(true)
  })
})
