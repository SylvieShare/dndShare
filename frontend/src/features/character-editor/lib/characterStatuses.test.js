import { describe, expect, it, vi } from 'vitest'
import {
  addStatusInstance,
  collectCharacterStatuses,
  linkedStatusActive,
  removeStatusInstancesByEffect,
  removeStatusInstancesByParam,
  statusEffectActive,
  statusInstanceActiveByParam,
  removeStatusesBySource,
  setStatusInstanceLevel,
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

  it('keeps a level on the runtime instance and changes it without mutating the item', () => {
    const effect = { id: 4, data: { level: 2 } }
    const states = addStatusInstance({ states: [] }, effect)

    expect(states[0].params.level).toBe(2)
    expect(setStatusInstanceLevel({ states }, states[0].uid, 3)[0].params.level).toBe(3)
    expect(effect.data.level).toBe(2)
  })

  it('drops concentration when a new effect blocks maintaining it', () => {
    const concentration = { uid: 'shield', effect_id: 2, concentration: true }
    const rage = { id: 3, data: { derived_effects: [
      { kind: 'activity_block', scopes: ['spellcasting', 'concentration'] },
    ] } }

    expect(addStatusInstance({ states: [concentration] }, rage)).toMatchObject([
      { effect_id: 3, concentration: false },
    ])
  })

  it('detects and removes an effect regardless of which source added it', () => {
    const values = { states: [
      { uid: 'manual-rage', effect_id: 100, source: { kind: 'manual' } },
      { uid: 'blessing', effect_id: 200, source: { kind: 'spell' } },
    ] }

    expect(statusEffectActive(values, { effect_id: 100 })).toBe(true)
    expect(removeStatusInstancesByEffect(values, { effect_id: 100 })).toMatchObject([
      { uid: 'blessing', effect_id: 200 },
    ])
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

  it('finds and removes a targeted effect by its runtime parameter', () => {
    const effect = { id: 12 }
    const values = { states: [
      { uid: 'sword', effect_id: 12, params: { weapon_uid: 'weapon-1' } },
      { uid: 'bow', effect_id: 12, params: { weapon_uid: 'weapon-2' } },
      { uid: 'blessing', effect_id: 13, params: {} },
    ] }

    expect(statusInstanceActiveByParam(values, effect, 'weapon_uid', 'weapon-1')).toBe(true)
    expect(statusInstanceActiveByParam(values, effect, 'weapon_uid', 'weapon-3')).toBe(false)
    expect(removeStatusInstancesByParam(values, 'weapon_uid', 'weapon-1')).toMatchObject([
      { uid: 'bow' },
      { uid: 'blessing' },
    ])
  })
})
