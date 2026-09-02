import { describe, expect, it } from 'vitest'
import { sessionHotkeyCommand } from './useSessionHotkeys'

function key(code, options = {}) {
  return { code, key: options.key || '', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...options }
}

describe('session hotkeys', () => {
  it('maps language-independent section and panel shortcuts', () => {
    expect(sessionHotkeyCommand(key('Digit1', { altKey: true }))).toEqual({ type: 'select-view', value: 'story' })
    expect(sessionHotkeyCommand(key('Digit5', { altKey: true }))).toEqual({ type: 'select-view', value: 'materials' })
    expect(sessionHotkeyCommand(key('Digit6', { altKey: true }))).toEqual({ type: 'select-view', value: 'music' })
    expect(sessionHotkeyCommand(key('Digit7', { altKey: true }))).toEqual({ type: 'select-view', value: 'journal' })
    expect(sessionHotkeyCommand(key('Digit8', { altKey: true }))).toEqual({ type: 'select-view', value: 'events' })
    expect(sessionHotkeyCommand(key('KeyD', { shiftKey: true }))).toEqual({ type: 'toggle-panel', value: 'dice' })
    expect(sessionHotkeyCommand(key('KeyM', { shiftKey: true }))).toBeNull()
    expect(sessionHotkeyCommand(key('KeyL', { shiftKey: true }))).toBeNull()
  })

  it('maps all seven dice without conflicting with section switching', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(number =>
      sessionHotkeyCommand(key(`Digit${number}`, { altKey: true, shiftKey: true })).value
    )).toEqual([4, 6, 8, 10, 12, 20, 100])
  })

  it('maps combat workspace, encounter, selection and turn shortcuts', () => {
    expect(sessionHotkeyCommand(key('KeyB', { shiftKey: true }))).toEqual({ type: 'toggle-combat-workspace' })
    expect(sessionHotkeyCommand(key('Enter', { shiftKey: true }))).toEqual({ type: 'toggle-encounter' })
    expect(sessionHotkeyCommand(key('KeyP', { shiftKey: true }))).toEqual({ type: 'toggle-player-selection' })
    expect(sessionHotkeyCommand(key('KeyN', { shiftKey: true }))).toEqual({ type: 'toggle-npc-selection' })
    expect(sessionHotkeyCommand(key('KeyA', { shiftKey: true }))).toEqual({ type: 'toggle-scene-selection' })
    expect(sessionHotkeyCommand(key('KeyR', { shiftKey: true }))).toEqual({ type: 'reroll-initiative' })
    expect(sessionHotkeyCommand(key('ArrowLeft', { key: 'ArrowLeft' }))).toEqual({ type: 'previous-turn' })
    expect(sessionHotkeyCommand(key('ArrowRight', { key: 'ArrowRight' }))).toEqual({ type: 'next-turn' })
    expect(sessionHotkeyCommand(key('Backspace', { key: 'Backspace' }))).toEqual({ type: 'remove-selected-npcs' })
  })

  it('maps vertical arrows to list navigation', () => {
    expect(sessionHotkeyCommand(key('ArrowUp', { key: 'ArrowUp' }))).toEqual({ type: 'previous-list-item' })
    expect(sessionHotkeyCommand(key('ArrowDown', { key: 'ArrowDown' }))).toEqual({ type: 'next-list-item' })
  })

  it('toggles contextual help and ignores incomplete combinations', () => {
    expect(sessionHotkeyCommand(key('Slash', { key: '?', shiftKey: true }))).toEqual({ type: 'toggle-hints' })
    expect(sessionHotkeyCommand(key('Digit7', { key: '?', shiftKey: true }))).toEqual({ type: 'toggle-hints' })
    expect(sessionHotkeyCommand(key('Escape', { key: 'Escape' }))).toEqual({ type: 'hide-hints' })
    expect(sessionHotkeyCommand(key('KeyD'))).toBeNull()
  })
})
