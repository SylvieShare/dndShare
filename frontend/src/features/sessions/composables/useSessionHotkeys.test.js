import { describe, expect, it } from 'vitest'
import { sessionHotkeyCommand } from './useSessionHotkeys'

function key(code, options = {}) {
  return { code, key: options.key || '', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...options }
}

describe('session hotkeys', () => {
  it('maps language-independent section and panel shortcuts', () => {
    expect(sessionHotkeyCommand(key('Digit1', { altKey: true }))).toEqual({ type: 'select-view', value: 'story' })
    expect(sessionHotkeyCommand(key('Digit5', { altKey: true }))).toEqual({ type: 'select-view', value: 'materials' })
    expect(sessionHotkeyCommand(key('KeyD', { shiftKey: true }))).toEqual({ type: 'toggle-panel', value: 'dice' })
    expect(sessionHotkeyCommand(key('KeyM', { shiftKey: true }))).toEqual({ type: 'toggle-panel', value: 'music' })
    expect(sessionHotkeyCommand(key('KeyL', { shiftKey: true }))).toEqual({ type: 'toggle-panel', value: 'events' })
  })

  it('maps all seven dice without conflicting with section switching', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(number =>
      sessionHotkeyCommand(key(`Digit${number}`, { altKey: true, shiftKey: true })).value
    )).toEqual([4, 6, 8, 10, 12, 20, 100])
  })

  it('toggles contextual help and ignores incomplete combinations', () => {
    expect(sessionHotkeyCommand(key('Slash', { key: '?', shiftKey: true }))).toEqual({ type: 'toggle-hints' })
    expect(sessionHotkeyCommand(key('Digit7', { key: '?', shiftKey: true }))).toEqual({ type: 'toggle-hints' })
    expect(sessionHotkeyCommand(key('Escape', { key: 'Escape' }))).toEqual({ type: 'hide-hints' })
    expect(sessionHotkeyCommand(key('KeyD'))).toBeNull()
  })
})
