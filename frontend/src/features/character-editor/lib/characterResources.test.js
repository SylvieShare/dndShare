import { describe, expect, it } from 'vitest'

import {
  collectCharacterResources,
  createAbilityResourceSource,
  createClassResourceSource,
  createManualResourceSource,
  restoreCharacterResources,
  setCharacterResourceAvailable,
} from './characterResources'
import { abilityUseTotal, abilityUsesAreManual } from '@/shared/lib/dndAbilityUses'

const sources = [
  createManualResourceSource('resources'),
  createClassResourceSource(),
  createAbilityResourceSource('abilities_race', '#123456'),
  createAbilityResourceSource('abilities_class', '#654321'),
]

const items = new Map([
  ['10', { id: 10, name: 'Дыхание дракона', data: { max_use_stat: 3, max_use_min: 1, rollback_short_rest: true } }],
  ['20', { id: 20, name: 'Второе дыхание', data: { max_use: 2, rollback_long_rest: true } }],
  ['30', { id: 30, name: 'Дроуская магия', data: {
    use_resources: [
      { key: 'faerie_fire', title: 'Огненные феи', level: 3, max_use: 1, rollback_long_rest: true },
      { key: 'darkness', title: 'Тьма', level: 5, max_use: 1, rollback_long_rest: true },
    ],
  } }],
  ['40', { id: 40, name: 'Вдохновение барда', data: {
    class_ids: [{ id: 100 }], max_use_stat: 6, max_use_min: 1,
    rollback_long_rest: true, rollback_short_rest_level: 5,
  } }],
  ['50', { id: 50, name: 'Очки чародейства', data: {
    class_ids: [{ id: 200 }], max_use_level_multiplier: 1,
    rollback_long_rest: true, short_rest_recovery: 4, short_rest_recovery_level: 20,
  } }],
  ['60', { id: 60, name: 'Цветная способность', data: { max_use: 1, resource_color: '#123abc' } }],
  ['300', { id: 300, name: 'Жрец', data: { class_resources: [{
    key: 'channel_divinity', title: 'Божественный канал', level: 2, max_use: 1,
    scaling: [{ level: 6, uses: 2 }, { level: 18, uses: 3 }],
    rollback_short_rest: true, rollback_long_rest: true,
  }] } }],
  ['400', { id: 400, name: 'Паладин', data: { class_resources: [{
    key: 'channel_divinity', title: 'Божественный канал', level: 3, max_use: 1,
    rollback_short_rest: true, rollback_long_rest: true,
  }] } }],
])

const values = {
  CON: { value: { base: 18, bonuses: [] } },
  CHA: { value: { base: 18, bonuses: [] } },
  lvl: { level: 7 },
  classes: [{ id: 100, level: 5 }, { id: 200, level: 2 }],
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
    expect(abilityUseTotal({ max_use_stat: 3, max_use_stat_multiplier: 2, max_use_bonus: 1, max_use_min: 2 }, values)).toBe(9)
    expect(abilityUseTotal({ max_use: 5 }, values)).toBe(5)
    expect(abilityUseTotal({ max_use: 5, manual_size: true }, values, { max_use: 7 })).toBe(7)
  })

  it('resolves class-level and explicit uses progression formulas', () => {
    expect(abilityUseTotal({ class_ids: [{ id: 200 }], max_use_level_multiplier: 5 }, values)).toBe(10)
    expect(abilityUseTotal({
      class_ids: [{ id: 100 }],
      max_use_scaling: true,
      scaling: [{ level: 1, uses: 2 }, { level: 5, uses: 3 }, { level: 9, uses: 4 }],
    }, values)).toBe(3)
    expect(abilityUseTotal({
      max_use_scaling: true,
      scaling: [{ level: 1, uses: 2 }, { level: 20, uses: 0 }],
    }, { lvl: { level: 20 } })).toBe(0)
    expect(abilityUseTotal({ class_ids: [{ id: 200 }], max_use_level_multiplier: 1 }, {
      lvl: { level: 8 }, classes: [{ id: 200, level: 1 }],
    })).toBe(8)
  })

  it('gives an explicit modifier formula priority over a stale manual flag', () => {
    const data = { max_use: 1, manual_size: true, max_use_stat: 3, max_use_min: 1 }
    expect(abilityUseTotal(data, values, { max_use: 9 })).toBe(4)
    expect(abilityUsesAreManual(data)).toBe(false)
  })

  it('combines editable and read-only contributed resources', () => {
    const result = collectCharacterResources(values, items, sources)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ title: 'Удача', readonly: false, value: 1, total: 3 })
    expect(result[1]).toMatchObject({ title: 'Дыхание дракона', source_label: 'способности', readonly: true, value: 2, total: 4, short_rest: true })
    expect(result[2]).toMatchObject({ item_id: 20, title: 'Второе дыхание', source_label: 'способности', readonly: true, value: 0, total: 2, long_rest: true })
  })

  it('uses configured colors and gives unconfigured abilities stable varied colors', () => {
    const coloredValues = {
      ...values,
      abilities_class: [{ id: 20 }, { id: 50 }, { id: 60 }],
    }
    const result = collectCharacterResources(coloredValues, items, sources)
      .filter((resource) => resource.readonly)
    expect(result.find((resource) => resource.title === 'Цветная способность').color_point).toBe('#123abc')
    expect(result.find((resource) => resource.title === 'Второе дыхание').color_point)
      .not.toBe(result.find((resource) => resource.title === 'Очки чародейства').color_point)
    expect(new Set(result.map((resource) => resource.color_point)).size).toBeGreaterThan(1)
  })

  it('writes use back to the contributing ability array', () => {
    const patch = setCharacterResourceAvailable(values, items, 'abilities:abilities_race:10', 1, sources)
    expect(patch).toEqual({ abilities_race: [{ id: 10, count: 1, resource_version: 1 }] })
  })

  it('exposes independent level-gated resources and persists each counter separately', () => {
    const multiValues = { ...values, abilities_race: [{ id: 30 }] }
    const result = collectCharacterResources(multiValues, items, sources)
      .filter((resource) => resource.key.startsWith('abilities:abilities_race:30:'))
    expect(result.map((resource) => resource.title)).toEqual(['Огненные феи', 'Тьма'])

    const patch = setCharacterResourceAvailable(
      multiValues,
      items,
      'abilities:abilities_race:30:faerie_fire',
      0,
      sources,
    )
    expect(patch.abilities_race[0]).toEqual({
      id: 30,
      resource_version: 1,
      resource_counts: { faerie_fire: 0 },
    })
  })

  it('hides nested resources until their owner level is reached', () => {
    const lowLevel = {
      ...values,
      lvl: { level: 4 },
      abilities_race: [{ id: 30 }],
    }
    expect(collectCharacterResources(lowLevel, items, sources)
      .filter((resource) => resource.key.startsWith('abilities:abilities_race:30:'))
      .map((resource) => resource.title)).toEqual(['Огненные феи'])
  })

  it('unlocks short-rest recovery at the configured class level and supports partial recovery', () => {
    const classValues = {
      ...values,
      classes: [{ id: 100, level: 5 }, { id: 200, level: 20 }],
      abilities_class: [{ id: 40, count: 0 }, { id: 50, count: 3 }],
    }
    const short = restoreCharacterResources(classValues, items, 'short', sources)
    expect(short.patch.abilities_class[0]).toMatchObject({ id: 40, count: 4, resource_version: 1 })
    expect(short.patch.abilities_class[1]).toMatchObject({ id: 50, count: 7, resource_version: 1 })
  })

  it('contributes sorcery points from the Font of Magic feature and Sorcerer level', () => {
    const sorcerer = {
      ...values,
      lvl: { level: 7 },
      classes: [{ id: 100, level: 5 }, { id: 200, level: 2 }],
      abilities_class: [{ id: 50 }],
    }
    expect(collectCharacterResources(sorcerer, items, sources)
      .find((resource) => resource.title === 'Очки чародейства')).toMatchObject({
      title: 'Очки чародейства',
      value: 2,
      total: 2,
      long_rest: true,
    })
  })

  it('combines cleric and paladin Channel Divinity into one class-level pool', () => {
    const multiclass = {
      lvl: { level: 9 },
      classes: [{ id: 300, level: 6 }, { id: 400, level: 3 }],
      class_resource_counts: { channel_divinity: 1 },
    }
    const resources = collectCharacterResources(multiclass, items, sources)
    const channel = resources.find((resource) => resource.pool_key === 'channel_divinity')

    expect(resources.filter((resource) => resource.pool_key === 'channel_divinity')).toHaveLength(1)
    expect(channel).toMatchObject({
      key: 'classes:channel_divinity',
      title: 'Божественный канал',
      value: 1,
      total: 2,
      short_rest: true,
      long_rest: true,
    })
    expect(setCharacterResourceAvailable(multiclass, items, channel.key, 0, sources)).toEqual({
      class_resource_counts: { channel_divinity: 0 },
    })
    expect(restoreCharacterResources({
      ...multiclass,
      class_resource_counts: { channel_divinity: 0 },
    }, items, 'short', sources)).toEqual({
      patch: { class_resource_counts: { channel_divinity: 2 } },
      recoveredNames: ['Божественный канал'],
    })
  })

  it('does not grant a second Channel Divinity use from paladin levels', () => {
    const resources = collectCharacterResources({
      lvl: { level: 9 },
      classes: [{ id: 300, level: 2 }, { id: 400, level: 7 }],
    }, items, sources)

    expect(resources.find((resource) => resource.pool_key === 'channel_divinity')).toMatchObject({
      value: 1,
      total: 1,
    })
  })

  it('unlocks the paladin Channel Divinity pool at paladin level three', () => {
    const levelTwo = { lvl: { level: 2 }, classes: [{ id: 400, level: 2 }] }
    const levelThree = { lvl: { level: 3 }, classes: [{ id: 400, level: 3 }] }

    expect(collectCharacterResources(levelTwo, items, sources)
      .some((resource) => resource.pool_key === 'channel_divinity')).toBe(false)
    expect(collectCharacterResources(levelThree, items, sources)
      .find((resource) => resource.pool_key === 'channel_divinity')).toMatchObject({
      value: 1,
      total: 1,
    })
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
