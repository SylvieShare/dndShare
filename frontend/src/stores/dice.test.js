import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDiceStore } from './dice'

describe('dice roll presentation metadata', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.useRealTimers())

  it('keeps a roll-level fallback color on the popup entry', () => {
    const store = useDiceStore()
    store.roll('Ловкость — проверка', 'd20+3', {
      crit_mode: true,
      color: '#7ab8e8',
    })

    expect(store.stack).toHaveLength(1)
    expect(store.stack[0].color).toBe('#7ab8e8')
    expect(store.stack[0].result.expression).toBe('d20+3')
    store.clear()
  })
})
