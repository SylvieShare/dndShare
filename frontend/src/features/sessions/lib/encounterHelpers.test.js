import { describe, expect, it } from 'vitest'
import { ensureCombatantLetters, setCombatantLetter } from './encounterHelpers'

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
