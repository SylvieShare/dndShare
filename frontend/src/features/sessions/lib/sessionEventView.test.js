import { describe, expect, it, vi } from 'vitest'
import { sessionEventActorLabel } from './sessionEventView'

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
})
