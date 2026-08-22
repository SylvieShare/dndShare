import { describe, expect, it } from 'vitest'
import { resolveRollMode } from './rollMode'

describe('resolveRollMode', () => {
  it('cancels automatic advantage and disadvantage regardless of source count', () => {
    const result = resolveRollMode('auto', [
      { mode: 'advantage', source: 'Помощь' },
      { mode: 'advantage', source: 'Невидимость' },
      { mode: 'disadvantage', source: 'Доспех' },
    ])
    expect(result.mode).toBe('normal')
    expect(result.cancelled).toBe(true)
    expect(result.source).toContain('взаимно отменяются')
  })

  it('uses one-sided automatic effects and keeps an explicit override', () => {
    expect(resolveRollMode('auto', [{ mode: 'advantage' }]).mode).toBe('advantage')
    expect(resolveRollMode('auto', [{ mode: 'disadvantage' }]).mode).toBe('disadvantage')
    expect(resolveRollMode('normal', [{ mode: 'disadvantage' }]).mode).toBe('normal')
  })
})
