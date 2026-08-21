import { describe, expect, it } from 'vitest'
import {
  STARTING_EQUIPMENT_CLASS_KEYS,
  mergeEquipment,
  resolveStartingEquipmentProfile,
  selectedStartingEquipment,
  startingEquipmentComplete,
  startingEquipmentProfile,
} from './startingEquipment'

const CLASS_NAMES = [
  'Варвар', 'Бард', 'Жрец', 'Друид', 'Воин', 'Монах',
  'Паладин', 'Следопыт', 'Плут', 'Чародей', 'Колдун', 'Волшебник',
]

function firstChoices(profile) {
  const choices = Object.fromEntries(profile.groups.map((group) => {
    const selected = group.options[0]
    const picks = Object.fromEntries((selected.picks || []).map((pick) => [
      pick.id,
      Array.from({ length: pick.count }, () => pick.options[0]),
    ]))
    return [group.id, { optionId: selected.id, picks }]
  }))
  if (profile.fixedPicks?.length) {
    choices.__fixed = {
      optionId: 'fixed',
      picks: Object.fromEntries(profile.fixedPicks.map((pick) => [
        pick.id,
        Array.from({ length: pick.count }, () => pick.options[0]),
      ])),
    }
  }
  return choices
}

describe('PHB starting equipment', () => {
  it('keeps parameterized variants in separate stacks', () => {
    const equipment = mergeEquipment(
      [{ item_id: 77, name: 'Верёвка пеньковая', count: 1, params: { length_ft: 50 } }],
      [{ item_id: 77, name: 'Верёвка пеньковая', count: 1, params: { length_ft: 30 } }],
      [{ item_id: 77, name: 'Верёвка пеньковая', count: 2, params: { length_ft: 50 } }],
    )
    expect(equipment).toEqual([
      { item_id: 77, name: 'Верёвка пеньковая', count: 3, params: { length_ft: 50 } },
      { item_id: 77, name: 'Верёвка пеньковая', count: 1, params: { length_ft: 30 } },
    ])
  })

  it('covers all twelve base classes in Russian', () => {
    const profiles = CLASS_NAMES.map((name) => startingEquipmentProfile({ name }))
    expect(profiles.every(Boolean)).toBe(true)
    expect(new Set(profiles.map((profile) => profile.key)).size).toBe(12)
    expect(STARTING_EQUIPMENT_CLASS_KEYS).toHaveLength(12)
    expect(startingEquipmentProfile({ name: 'Разбойник' })?.key).toBe('rogue')
  })

  it.each(CLASS_NAMES)('can complete every choice for %s', (name) => {
    const profile = startingEquipmentProfile({ name })
    const choices = firstChoices(profile)
    expect(startingEquipmentComplete(profile, choices)).toBe(true)
    expect(selectedStartingEquipment(profile, choices).length).toBeGreaterThan(0)
  })

  it('assembles the rogue equipment from the selected bundles and fixed items', () => {
    const profile = startingEquipmentProfile({ name: 'Плут' })
    const equipment = selectedStartingEquipment(profile, {
      weapon_1: { optionId: 'rapier', picks: {} },
      weapon_2: { optionId: 'shortbow', picks: {} },
      pack: { optionId: 'burglar', picks: {} },
    })

    expect(equipment).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Рапира', count: 1 }),
      expect.objectContaining({ name: 'Короткий лук', count: 1 }),
      expect.objectContaining({ name: 'Стрела', count: 20 }),
      expect.objectContaining({ name: 'Кинжал', count: 2 }),
      expect.objectContaining({ name: 'Воровские инструменты', count: 1 }),
    ]))
  })

  it('requires the concrete weapon behind an "any weapon" choice', () => {
    const profile = startingEquipmentProfile({ name: 'Варвар' })
    const choices = {
      weapon_1: { optionId: 'martial_melee', picks: {} },
      weapon_2: { optionId: 'handaxes', picks: {} },
    }
    expect(startingEquipmentComplete(profile, choices)).toBe(false)
    choices.weapon_1.picks.weapon = ['Глефа']
    expect(startingEquipmentComplete(profile, choices)).toBe(true)
  })

  it('resolves class choices to handbook item ids', () => {
    const catalogue = [
      { id: 101, name: 'Рапира', typeId: 1, data: {} },
      { id: 102, name: 'Короткий меч', typeId: 1, data: {} },
      { id: 103, name: 'Короткий лук', typeId: 1, data: {} },
      { id: 104, name: 'Колчан', typeId: 2, data: {} },
      { id: 105, name: 'Стрела', typeId: 2, data: {} },
      { id: 106, name: 'Набор взломщика', typeId: 2, data: {} },
      { id: 107, name: 'Кожаный доспех', typeId: 12, data: { armor: { ac: 11, use_dex: true } } },
      { id: 108, name: 'Кинжал', typeId: 1, data: {} },
      { id: 109, name: 'Воровские инструменты', typeId: 2, data: {} },
    ]
    const profile = resolveStartingEquipmentProfile(startingEquipmentProfile({ name: 'Плут' }), catalogue)
    const equipment = selectedStartingEquipment(profile, {
      weapon_1: { optionId: 'rapier', picks: {} },
      weapon_2: { optionId: 'shortbow', picks: {} },
      pack: { optionId: 'burglar', picks: {} },
    })

    expect(equipment.find((entry) => entry.name === 'Рапира')).toMatchObject({ item_id: 101, typeId: 1, params: { magic_bonus: 0 } })
    expect(equipment.find((entry) => entry.name === 'Кожаный доспех')).toMatchObject({
      item_id: 107,
      typeId: 12,
      armor: { ac: 11, use_dex: true },
    })
  })

  it('chooses one canonical purchasable row when old data contains duplicate names', () => {
    const profile = startingEquipmentProfile({ name: 'Волшебник' })
    const resolved = resolveStartingEquipmentProfile(profile, [
      { id: 900, name: 'Кинжал', typeId: 1, data: {} },
      { id: 901, name: 'Кинжал', typeId: 1, data: { available_in_starting_shop: true } },
      { id: 902, name: 'Боевой посох', typeId: 1, data: { available_in_starting_shop: true } },
      { id: 903, name: 'Мешочек с компонентами', typeId: 2, data: { available_in_starting_shop: true } },
      { id: 904, name: 'Набор учёного', typeId: 2, data: { available_in_starting_shop: true } },
      { id: 905, name: 'Книга заклинаний', typeId: 2, data: { available_in_starting_shop: true } },
    ])

    expect(resolved.groups[0].options.find((option) => option.id === 'dagger').items[0].item.id).toBe(901)
  })
})
