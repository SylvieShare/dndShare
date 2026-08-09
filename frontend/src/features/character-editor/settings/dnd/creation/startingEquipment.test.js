import { describe, expect, it } from 'vitest'
import {
  STARTING_EQUIPMENT_CLASS_KEYS,
  selectedStartingEquipment,
  startingEquipmentComplete,
  startingEquipmentProfile,
} from './startingEquipment'

const CLASS_NAMES = [
  'Варвар', 'Бард', 'Жрец', 'Друид', 'Воин', 'Монах',
  'Паладин', 'Следопыт', 'Плут', 'Чародей', 'Колдун', 'Волшебник',
]

function firstChoices(profile) {
  return Object.fromEntries(profile.groups.map((group) => {
    const selected = group.options[0]
    const picks = Object.fromEntries((selected.picks || []).map((pick) => [
      pick.id,
      Array.from({ length: pick.count }, () => pick.options[0]),
    ]))
    return [group.id, { optionId: selected.id, picks }]
  }))
}

describe('PHB starting equipment', () => {
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
    const profile = startingEquipmentProfile('Плут')
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
    const profile = startingEquipmentProfile('Варвар')
    const choices = {
      weapon_1: { optionId: 'martial_melee', picks: {} },
      weapon_2: { optionId: 'handaxes', picks: {} },
    }
    expect(startingEquipmentComplete(profile, choices)).toBe(false)
    choices.weapon_1.picks.weapon = ['Глефа']
    expect(startingEquipmentComplete(profile, choices)).toBe(true)
  })
})
