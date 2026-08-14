import { describe, expect, it, vi } from 'vitest'
import { sessionEventAuthorLabel, sessionEventCharacterName } from './sessionEventView'

describe('session event identity', () => {
  it('shows the character independently from the player who performed the action', () => {
    const resolveName = vi.fn(() => 'Лиора')
    const event = {
      actorTemplateId: 7,
      actorData: { dnd: { name: 'Лиора' } },
      authorLogin: 'andrey',
      authorRole: 'player',
    }

    expect(sessionEventCharacterName(event, resolveName)).toBe('Лиора')
    expect(resolveName).toHaveBeenCalledWith({ templateId: 7, data: event.actorData })
    expect(sessionEventAuthorLabel(event)).toBe('Игрок: andrey')
  })

  it('labels a DM separately even when a character is present', () => {
    const event = { authorLogin: 'dm-login', authorRole: 'gm' }

    expect(sessionEventAuthorLabel(event)).toBe('Мастер: dm-login')
  })

  it('does not invent a character for session-level events', () => {
    expect(sessionEventCharacterName({ authorRole: 'gm' }, vi.fn())).toBe('')
  })
})
