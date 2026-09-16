import { describe, expect, it, vi } from 'vitest'
import { handleCtrlSelection } from './ctrlSelection'
describe('Ctrl selection gesture', () => {
  it('consumes one Ctrl click before menus and native label toggles', () => {
    const event = { ctrlKey: true, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    const toggle = vi.fn()
    expect(handleCtrlSelection(event, true, toggle)).toBe(true)
    expect(toggle).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
  })
  it('leaves ordinary clicks and unavailable selection alone', () => {
    for (const [ctrlKey, enabled, button] of [[false, true, 0], [true, false, 0], [true, true, 2]]) {
      const toggle = vi.fn()
      expect(handleCtrlSelection({ ctrlKey, button }, enabled, toggle)).toBe(false)
      expect(toggle).not.toHaveBeenCalled()
    }
  })
  it('supports Cmd on macOS', () => {
    const event = { metaKey: true, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    const toggle = vi.fn()
    expect(handleCtrlSelection(event, true, toggle)).toBe(true)
    expect(toggle).toHaveBeenCalledOnce()
  })
  it('supports the macOS Ctrl-contextmenu gesture', () => {
    const event = { type: 'contextmenu', ctrlKey: true, button: 2, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    const toggle = vi.fn()
    expect(handleCtrlSelection(event, true, toggle)).toBe(true)
    expect(toggle).toHaveBeenCalledOnce()
  })
})
