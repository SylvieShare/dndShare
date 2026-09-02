import { describe, expect, it } from 'vitest'
import { ensureCombatantLetters, hpAfterDamage, normalizeEncounterPosition, setCombatantLetter } from './encounterHelpers'

describe('encounter letter markers', () => {
  it('assigns the nearest free Latin letters to NPCs only', () => {
    const combatants = [
      { uid: 'player', type: 'player' },
      { uid: 'first', type: 'npc' },
      { uid: 'reserved', type: 'npc', markerLetter: 'C' },
      { uid: 'second', type: 'npc' },
    ]

    ensureCombatantLetters(combatants)

    expect(combatants.map(c => c.markerLetter)).toEqual([undefined, 'A', 'C', 'B'])
  })

  it('swaps occupied letters instead of creating duplicates', () => {
    const combatants = [
      { uid: 'first', type: 'npc', markerLetter: 'A' },
      { uid: 'second', type: 'npc', markerLetter: 'B' },
    ]

    setCombatantLetter(combatants, 'first', 'B')

    expect(combatants.map(c => c.markerLetter)).toEqual(['B', 'A'])
  })
})

describe('encounter state normalization', () => {
  it('moves missing and obsolete positions into the current reserve group', () => {
    expect(normalizeEncounterPosition()).toBe('reserve')
    expect(normalizeEncounterPosition('players')).toBe('reserve')
    expect(normalizeEncounterPosition('combat')).toBe('combat')
    expect(normalizeEncounterPosition('dead')).toBe('dead')
  })

  it('applies shared damage to temporary HP before current HP', () => {
    expect(hpAfterDamage({ current: 12, max: 12, temp: 3 }, 5)).toEqual({ current: 10, max: 12, temp: 0 })
    expect(hpAfterDamage({ current: 2, max: 12, temp: 0 }, 8)).toEqual({ current: 0, max: 12, temp: 0 })
  })
})
