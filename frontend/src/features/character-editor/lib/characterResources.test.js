import { describe, expect, it } from 'vitest'

import {
  collectCharacterResources,
  createAbilityResourceSource,
  createManualResourceSource,
  restoreCharacterResources,
  setCharacterResourceAvailable,
} from './characterResources'
import { abilityUseTotal } from '@/shared/lib/dndAbilityUses'

const sources = [
  createManualResourceSource('resources'),
  createAbilityResourceSource('abilities_race', '#123456'),
  createAbilityResourceSource('abilities_class', '#654321'),
]

const items = new Map([
  ['10', { id: 10, name: 'Дыхание дракона', data: { max_use_stat: 3, max_use_min: 1, rollback_short_rest: true } }],
  ['20', { id: 20, name: 'Второе дыхание', data: { max_use: 2, rollback_long_rest: true } }],
])

const values = {
  CON: { value: { base: 18, bonuses: [] } },
  resources: [{ title: 'Удача', value: 1, total: 3, short_rest: true }],
  abilities_race: [{ id: 10, count: 2 }],
  abilities_class: [{ id: 20, count: 0 }],
}

describe('character resource sources', () => {
  it('resolves a modifier maximum with a configured minimum', () => {
    expect(abilityUseTotal({ max_use_stat: 3, max_use_min: 1 }, values)).toBe(4)
    expect(abilityUseTotal({ max_use_stat: 3, max_use_min: 2 }, {
      CON: { value: { base: 10, bonuses: [] } },
    })).toBe(2)
    expect(abilityUseTotal({ max_use: 5 }, values)).toBe(5)
    expect(abilityUseTotal({ max_use: 5, manual_size: true }, values, { max_use: 7 })).toBe(7)
  })

  it('combines editable and read-only contributed resources', () => {
    const result = collectCharacterResources(values, items, sources)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ title: 'Удача', readonly: false, value: 1, total: 3 })
    expect(result[1]).toMatchObject({ title: 'Дыхание дракона', readonly: true, value: 2, total: 4, short_rest: true })
    expect(result[2]).toMatchObject({ title: 'Второе дыхание', readonly: true, value: 0, total: 2, long_rest: true })
  })

  it('writes use back to the contributing ability array', () => {
    const patch = setCharacterResourceAvailable(values, items, 'abilities:abilities_race:10', 1, sources)
    expect(patch).toEqual({ abilities_race: [{ id: 10, count: 1 }] })
  })

  it('restores every matching source through one rest contract', () => {
    const short = restoreCharacterResources(values, items, 'short', sources)
    expect(short.patch.resources[0].value).toBe(3)
    expect(short.patch.abilities_race[0].count).toBe(4)
    expect(short.patch.abilities_class).toBeUndefined()
    expect(short.recoveredNames).toEqual(['Удача', 'Дыхание дракона'])

    const long = restoreCharacterResources(values, items, 'long', sources)
    expect(long.patch.abilities_race[0].count).toBe(4)
    expect(long.patch.abilities_class[0].count).toBe(2)
    expect(long.recoveredNames).toEqual(['Удача', 'Дыхание дракона', 'Второе дыхание'])
  })

  it('accepts another resource-source implementation without changing consumers', () => {
    const magicItemSource = {
      id: 'magic-items',
      itemIds: () => [],
      collect: () => [{ key: 'wand', title: 'Жезл', value: 2, total: 3, readonly: true, source: { sourceId: 'magic-items' } }],
      setAvailable: () => ({ items: [{ uid: 'wand', charges: 1 }] }),
      restore: () => ({ patch: {}, recoveredNames: [] }),
    }
    expect(collectCharacterResources(values, items, [magicItemSource])[0].title).toBe('Жезл')
    expect(setCharacterResourceAvailable(values, items, 'wand', 1, [magicItemSource])).toEqual({ items: [{ uid: 'wand', charges: 1 }] })
  })
})
