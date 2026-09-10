import { describe, expect, it } from 'vitest'
import { SESSION_VIEW_SHORTCUTS } from './sessionShortcuts'
import { sessionHotkeyCommand } from '../composables/useSessionHotkeys'

describe('session view shortcuts', () => {
  it('opens the separate quest catalogue with Alt+4 without moving diary shortcuts', () => {
    expect(SESSION_VIEW_SHORTCUTS.quests).toBe('Digit4')
    expect(sessionHotkeyCommand({ code: 'Digit4', altKey: true })).toEqual({ type: 'select-view', value: 'quests' })
    expect(SESSION_VIEW_SHORTCUTS.journal).toBe('Digit7')
    const codes = Object.values(SESSION_VIEW_SHORTCUTS)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
