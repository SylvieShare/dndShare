import { describe, expect, it } from 'vitest'
import { filterSessionEvents, sessionEventActorOptions, sessionEventCategory } from './sessionEventFilters'

const events = [
  { id: 1, type: 'dice_roll', actorName: 'Кобольд A', authorIsSessionOwner: true },
  { id: 2, type: 'spell_used', actorName: 'Лиора', actorCharUuid: 'char-1', authorIsSessionOwner: false },
  { id: 3, type: 'encounter_started', authorIsSessionOwner: true },
]

describe('session event filters', () => {
  it('maps event types into user-facing categories', () => {
    expect(sessionEventCategory('dice_roll')).toBe('dice')
    expect(sessionEventCategory('spell_used')).toBe('character')
    expect(sessionEventCategory('feature_state')).toBe('character')
    expect(sessionEventCategory('status_effect')).toBe('character')
    expect(sessionEventCategory('encounter_started')).toBe('combat')
  })

  it('combines author, actor and category filters', () => {
    expect(filterSessionEvents(events, { author: 'owner' }).map(event => event.id)).toEqual([1, 3])
    expect(filterSessionEvents(events, { author: 'players', categories: ['character'] }).map(event => event.id)).toEqual([2])
    expect(filterSessionEvents(events, { actor: 'name:кобольд a', categories: ['dice'] }).map(event => event.id)).toEqual([1])
  })

  it('builds unique actor choices and keeps system events last', () => {
    expect(sessionEventActorOptions(events)).toEqual([
      { value: 'name:кобольд a', label: 'Кобольд A', system: false },
      { value: 'character:char-1', label: 'Лиора', system: false },
      { value: 'system', label: 'Системные события', system: true },
    ])
  })
})
