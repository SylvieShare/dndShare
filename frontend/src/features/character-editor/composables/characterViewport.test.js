import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasCharacterViewportRecovered,
  measureCharacterViewport,
  resolveCharacterViewportHeight,
  useCharacterViewport,
} from './characterViewport'

function listenerTarget(properties = {}) {
  const listeners = new Map()
  const options = new Map()
  return Object.assign(properties, {
    listeners,
    options,
    addEventListener(type, listener, listenerOptions) {
      listeners.set(type, listener)
      options.set(type, listenerOptions)
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type)
    },
    dispatch(type, target = this) {
      listeners.get(type)?.({ target })
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('character mobile viewport', () => {
  it('uses the visual viewport while the keyboard is closed', () => {
    const measurement = measureCharacterViewport(
      { innerHeight: 844, visualViewport: { height: 792 } },
      { clientHeight: 844 },
    )

    expect(measurement).toEqual({ layoutHeight: 844, visualHeight: 792 })
    expect(resolveCharacterViewportHeight(measurement)).toBe(792)
  })

  it('keeps the pre-keyboard height when both viewport values shrink', () => {
    const keyboardMeasurement = measureCharacterViewport(
      { innerHeight: 498, visualViewport: { height: 498 } },
      { clientHeight: 498 },
    )

    expect(resolveCharacterViewportHeight(keyboardMeasurement, 792)).toBe(792)
  })

  it('uses the recovered viewport after the lock is released', () => {
    const recoveredMeasurement = measureCharacterViewport(
      { innerHeight: 844, visualViewport: { height: 792 } },
      { clientHeight: 844 },
    )

    expect(resolveCharacterViewportHeight(recoveredMeasurement, 0)).toBe(792)
    expect(hasCharacterViewportRecovered(recoveredMeasurement, 792)).toBe(true)
  })

  it('does not release the lock while the keyboard-sized viewport is stale', () => {
    const staleMeasurement = measureCharacterViewport(
      { innerHeight: 498, visualViewport: { height: 498 } },
      { clientHeight: 498 },
    )

    expect(hasCharacterViewportRecovered(staleMeasurement, 792)).toBe(false)
  })

  it('locks for a teleported editable and removes document listeners on stop', () => {
    vi.useFakeTimers()
    const properties = new Map()
    const visualViewport = listenerTarget({ height: 792 })
    const windowObject = listenerTarget({
      innerHeight: 844,
      visualViewport,
      scrollY: 20,
      scrollTo: vi.fn(() => { windowObject.scrollY = 0 }),
    })
    const documentObject = listenerTarget({
      activeElement: null,
      documentElement: {
        clientHeight: 844,
        style: {
          setProperty: (name, value) => properties.set(name, value),
          removeProperty: name => properties.delete(name),
        },
      },
    })
    const editable = { matches: selector => selector.includes('[contenteditable="true"]') }
    const nonEditable = { matches: () => false }
    const viewport = useCharacterViewport(ref(true), { windowObject, documentObject })

    viewport.startViewportHeightSync()
    expect(documentObject.options.get('focusin')).toBe(true)
    documentObject.activeElement = editable
    documentObject.dispatch('focusin', editable)

    windowObject.innerHeight = 498
    documentObject.documentElement.clientHeight = 498
    visualViewport.height = 498
    visualViewport.dispatch('resize')
    expect(properties.get('--character-viewport-height')).toBe('792px')

    documentObject.activeElement = nonEditable
    documentObject.dispatch('focusout', editable)
    vi.advanceTimersByTime(600)
    expect(properties.get('--character-viewport-height')).toBe('792px')
    expect(windowObject.scrollTo).toHaveBeenCalledWith(0, 0)

    windowObject.innerHeight = 844
    documentObject.documentElement.clientHeight = 844
    visualViewport.height = 760
    visualViewport.dispatch('resize')
    expect(properties.get('--character-viewport-height')).toBe('760px')

    viewport.stopViewportHeightSync()
    expect(documentObject.listeners.has('focusin')).toBe(false)
    expect(documentObject.listeners.has('focusout')).toBe(false)
    expect(properties.has('--character-viewport-height')).toBe(false)
  })
})
