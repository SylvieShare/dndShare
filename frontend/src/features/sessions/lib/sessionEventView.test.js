import { describe, expect, it } from 'vitest'
import { groupSessionEvents, sessionEventActorKey, sessionEventActorLabel } from './sessionEventView'

describe('session event identity', () => {
  it('uses the immutable actor name stored with the event', () => {
    expect(sessionEventActorLabel({ actorName: 'Лиора', authorRole: 'player' })).toBe('Лиора')
    expect(sessionEventActorLabel({ actorName: 'Кобольд', authorRole: 'gm' })).toBe('Кобольд')
  })

  it('leaves session-level events without an actor label', () => {
    expect(sessionEventActorLabel({ authorRole: 'gm' })).toBe('')
    expect(sessionEventActorKey({ authorRole: 'gm' })).toBe('system')
  })

  it('prefers character identity and otherwise groups named creatures', () => {
    expect(sessionEventActorKey({ actorCharUuid: 'char-1', actorName: 'Лиора' }))
      .toBe('character:char-1')
    expect(sessionEventActorKey({ actorName: 'Кобольд' })).toBe('name:кобольд')
  })

  it('groups newest events by minute and consecutive actor', () => {
    const events = [
      { id: 1, createdAt: '2026-08-14T10:40:10Z' },
      { id: 2, createdAt: '2026-08-14T10:41:10Z', actorCharUuid: 'char-1', actorName: 'Лиора' },
      { id: 3, createdAt: '2026-08-14T10:41:20Z', actorCharUuid: 'char-1', actorName: 'Лиора' },
      { id: 4, createdAt: '2026-08-14T10:41:30Z' },
      { id: 5, createdAt: '2026-08-14T10:41:40Z', actorName: 'Кобольд' },
    ]

    const groups = groupSessionEvents(events)

    expect(groups).toHaveLength(2)
    expect(groups[0].actors.map(group => group.label)).toEqual(['Кобольд', '', 'Лиора'])
    expect(groups[0].actors.map(group => group.events.map(event => event.id))).toEqual([[5], [4], [3, 2]])
    expect(groups[1].actors[0].events[0].id).toBe(1)
  })
})
