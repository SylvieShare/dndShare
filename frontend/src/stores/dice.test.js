import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDiceStore } from './dice'
import { useSessionEventsStore } from './sessionEvents'

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

  it('can log an embedded roll without adding a global popup', () => {
    const store = useDiceStore()
    const publish = vi.spyOn(useSessionEventsStore(), 'publish').mockResolvedValue(null)
    const result = store.roll('Спасбросок ловкости', 'd20+2', {
      crit_mode: true,
      popup: false,
      actor: { name: 'Гоблин', charUuid: null },
    })

    expect(result.expression).toBe('d20+2')
    expect(store.stack).toHaveLength(0)
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dice_roll',
      action: 'Спасбросок ловкости',
      actor: { name: 'Гоблин', charUuid: null },
    }))
  })

  it('keeps the correct d20 for advantage and ignores the discarded natural result', () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
    const store = useDiceStore()
    const result = store.rollD20('Проверка', 3, 'advantage', { crit_mode: true, log: false })

    expect(result.parts[0].rolls).toEqual([1, 20])
    expect(result.parts[0].keptIndex).toBe(1)
    expect(result.parts[0].dropped).toEqual([0])
    expect(result.total).toBe(23)
    expect(result.rollMode).toBe('advantage')
    expect(store.stack[0].outcome).toEqual({ kind: 'crit', sides: 20, value: 20 })
    random.mockRestore()
    store.clear()
  })

  it('offers a one-time reroll action for a matching natural-one trigger', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    const store = useDiceStore()
    store.rollD20('Атака', 2, 'normal', {
      log: false,
      roll_triggers: [{ event: 'natural_one', action: 'reroll', source_label: 'Везучий' }],
    })

    expect(store.stack[0].actions[0].label).toContain('Везучий')
    store.runAction(store.stack[0].id, 'reroll')
    expect(store.stack).toHaveLength(1)
    expect(store.stack[0].result.parts[0].rolls).toEqual([11])
    expect(store.stack[0].actions).toEqual([])
    random.mockRestore()
    store.clear()
  })

  it('honors a character-derived weapon critical threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.91)
    const store = useDiceStore()
    store.rollD20('Атака чемпиона', 0, 'normal', { crit_mode: true, critical_threshold: 19, log: false })
    expect(store.stack[0].outcome).toMatchObject({ kind: 'crit', value: 19 })
  })
})
