import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/stores/ui'
import {
  isAppHeaderScrollSource,
  useAppHeaderCollapse,
} from './useAppHeaderCollapse'

class FakeElement {
  constructor() {
    this.scrollTop = 0
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type)
  }

  dispatch(type, event = {}) {
    this.listeners.get(type)?.(event)
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('collapsible app-header scroll source', () => {
  it('collapses after the nested scroller settles and expands at its top', () => {
    const enabled = ref(true)
    const source = new FakeElement()
    const controller = useAppHeaderCollapse(enabled, {
      ElementClass: FakeElement,
      windowObject: {},
    })
    const uiStore = useUiStore()

    expect(controller.startScrollSource(source)).toBe(true)
    source.scrollTop = 42
    source.dispatch('scroll')
    expect(uiStore.headerHidden).toBe(false)

    vi.advanceTimersByTime(120)
    expect(uiStore.headerHidden).toBe(true)

    source.scrollTop = 0
    source.dispatch('scroll')
    expect(uiStore.headerHidden).toBe(false)
    controller.dispose()
  })

  it('rejects Vue fragment anchors as scroll sources', () => {
    const fragmentAnchor = { scrollTop: 0, addEventListener() {} }
    expect(isAppHeaderScrollSource(fragmentAnchor, {}, FakeElement)).toBe(false)

    const controller = useAppHeaderCollapse(ref(true), {
      ElementClass: FakeElement,
      windowObject: {},
    })
    expect(controller.startScrollSource(fragmentAnchor)).toBe(false)
    controller.dispose()
  })

  it('keeps the header visible when collapse mode is disabled', () => {
    const source = new FakeElement()
    source.scrollTop = 80
    const onSettled = vi.fn()
    const controller = useAppHeaderCollapse(ref(false), {
      ElementClass: FakeElement,
      windowObject: {},
      onSettled,
    })

    controller.startScrollSource(source)
    source.dispatch('scroll')
    vi.advanceTimersByTime(120)
    expect(useUiStore().headerHidden).toBe(false)
    expect(onSettled).toHaveBeenCalledWith({ y: 80, hidden: false })
    controller.dispose()
  })
})
