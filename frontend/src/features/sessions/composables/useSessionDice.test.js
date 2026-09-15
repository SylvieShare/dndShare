import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionDice } from './useSessionDice'
const store = vi.hoisted(() => ({ roll: vi.fn(), pushEntry: vi.fn() }))
vi.mock('@/stores/dice', () => ({ useDiceStore: () => store }))
beforeEach(() => vi.clearAllMocks())
describe('persistent session dice controller', () => {
  it('rolls from keyboard without a mounted dice panel and retains the chosen mode', () => {
    const dice = useSessionDice()
    dice.rollDie(20)
    expect(store.roll).toHaveBeenCalledWith('d20', 'd20', { crit_mode: true })
    dice.mode.value = 'advantage'
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(.99)
    dice.rollDie(20)
    expect(store.pushEntry).toHaveBeenCalledWith(expect.objectContaining({
      outcome: { kind: 'crit', sides: 20, value: 20 },
      result: expect.objectContaining({ total: 20, expression: '2d20kh' }),
    }))
    expect(dice.mode.value).toBe('advantage')
    random.mockRestore()
  })
})
