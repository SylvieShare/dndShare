import { describe, expect, it, vi } from 'vitest'
import { groupSessionEvents, sessionEventActorKey, sessionEventActorLabel } from './sessionEventView'

describe('session event identity', () => {
  it('shows only the character name for a player action', () => {
    const resolveName = vi.fn(() => 'Лиора')
    const event = {
      actorTemplateId: 7,
      actorData: { dnd: { name: 'Лиора' } },
      authorRole: 'player',
    }

    expect(sessionEventActorLabel(event, resolveName)).toBe('Лиора')
    expect(resolveName).toHaveBeenCalledWith({ templateId: 7, data: event.actorData })
  })

  it('marks a character action performed by the DM', () => {
    const event = { actorTemplateId: 7, actorData: {}, authorRole: 'gm' }

    expect(sessionEventActorLabel(event, () => 'Лиора')).toBe('Лиора (мастер)')
  })

  it('shows the DM role for a session-level action', () => {
    expect(sessionEventActorLabel({ authorRole: 'gm' }, vi.fn())).toBe('Мастер')
  })

  it('keeps session DM and character DM in separate actor groups', () => {
    expect(sessionEventActorKey({ authorRole: 'gm' })).toBe('gm:session')
    expect(sessionEventActorKey({ authorRole: 'gm', actorCharUuid: 'char-1' }))
      .toBe('gm:character:char-1')
  })

  it('groups newest events by minute and consecutive actor', () => {
    const events = [
      { id: 1, createdAt: '2026-08-14T10:40:10Z', authorRole: 'gm' },
      { id: 2, createdAt: '2026-08-14T10:41:10Z', authorRole: 'gm', actorCharUuid: 'char-1', actorTemplateId: 7, actorData: {} },
      { id: 3, createdAt: '2026-08-14T10:41:20Z', authorRole: 'gm', actorCharUuid: 'char-1', actorTemplateId: 7, actorData: {} },
      { id: 4, createdAt: '2026-08-14T10:41:30Z', authorRole: 'gm' },
      { id: 5, createdAt: '2026-08-14T10:41:40Z', authorRole: 'gm', actorCharUuid: 'char-1', actorTemplateId: 7, actorData: {} },
    ]

    const groups = groupSessionEvents(events, () => 'Лиора')

    expect(groups).toHaveLength(2)
    expect(groups[0].actors.map(group => group.label)).toEqual(['Лиора (мастер)', 'Мастер', 'Лиора (мастер)'])
    expect(groups[0].actors.map(group => group.events.map(event => event.id))).toEqual([[5], [4], [3, 2]])
    expect(groups[1].actors[0].events[0].id).toBe(1)
  })
})
