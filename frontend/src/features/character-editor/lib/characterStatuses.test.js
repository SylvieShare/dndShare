import { describe, expect, it, vi } from 'vitest'
import {
  addStatusInstance,
  collectCharacterStatuses,
  linkedStatusActive,
  removeStatusesBySource,
  statusEffectLinks,
  toggleLinkedStatus,
} from './characterStatuses'

describe('character statuses', () => {
  it('normalizes several effect links declared by one source item', () => {
    const item = { data: { status_effects: [
      { key: 'blessed', effect: { id: 10 } },
      { key: 'warded', effect_id: 11 },
    ] } }
    expect(statusEffectLinks(item)).toMatchObject([
      { key: 'blessed', effect_id: 10 },
      { key: 'warded', effect_id: 11 },
    ])
  })

  it('creates a source-owned instance and binds the current scaling value', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const values = { lvl: { level: 3 }, abilities_class: [{ id: 5 }], states: [] }
    const ability = {
      id: 5,
      name: 'Ярость',
      data: {
        scaling: [{ level: 1, value: '+2' }, { level: 9, value: '+3' }],
        status_effects: [{
          key: 'rage', effect: { id: 100 },
          parameter_bindings: [{ key: 'damage_bonus', source: 'scaling_value' }],
        }],
      },
    }
    const effect = { id: 100, data: { duration: { kind: 'manual' } } }
    const link = statusEffectLinks(ability)[0]
    const source = { kind: 'ability', value_id: 'abilities_class', entry_key: '5' }
    const states = toggleLinkedStatus(values, effect, ability, link, source)

    expect(states).toMatchObject([{
      effect_id: 100,
      params: { damage_bonus: 2 },
      source: { kind: 'ability', item_id: 5, value_id: 'abilities_class', entry_key: '5', link_key: 'rage' },
    }])
    expect(linkedStatusActive({ ...values, states }, ability, link, source)).toBe(true)
    expect(toggleLinkedStatus({ ...values, states }, effect, ability, link, source)).toEqual([])
    vi.restoreAllMocks()
  })

  it('keeps one non-stackable effect and replaces concentration', () => {
    const first = { id: 1, data: { concentration: true } }
    const second = { id: 2, data: { concentration: true } }
    const once = addStatusInstance({ states: [] }, first)
    expect(addStatusInstance({ states: once }, first)).toHaveLength(1)
    expect(addStatusInstance({ states: once }, second)).toMatchObject([{ effect_id: 2, concentration: true }])
  })

  it('collects polarity and removes all links owned by a deleted source', () => {
    const values = { states: [
      { uid: 'a', effect_id: 7, source: { kind: 'spell', item_id: 20, value_id: 'spells', entry_key: '20', link_key: 'one' } },
      { uid: 'b', effect_id: 8, source: { kind: 'spell', item_id: 20, value_id: 'spells', entry_key: '20', link_key: 'two' } },
      { uid: 'c', effect_id: 9, source: { kind: 'manual' } },
    ] }
    const items = new Map([['7', { id: 7, name: 'Благословение', data: { polarity: 'positive' } }]])
    expect(collectCharacterStatuses(values, items)[0]).toMatchObject({ title: 'Благословение', polarity: 'positive' })
    expect(removeStatusesBySource(values, { kind: 'spell', item_id: 20, value_id: 'spells', entry_key: '20' }))
      .toMatchObject([{ uid: 'c' }])
  })
})
