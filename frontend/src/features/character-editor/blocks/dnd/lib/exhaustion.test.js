import { describe, expect, it } from 'vitest'
import { normalizeExhaustion } from './exhaustion'

describe('D&D exhaustion normalization', () => {
  it('uses the six standard levels for an empty value', () => {
    const normalized = normalizeExhaustion(null)

    expect(normalized.level).toBe(0)
    expect(normalized.max).toBe(6)
    expect(normalized.effects).toHaveLength(6)
  })

  it('clamps the visible level and preserves configured effects', () => {
    const normalized = normalizeExhaustion({ level: 9, max: 2, effects: ['Первый', 'Второй'] })

    expect(normalized.level).toBe(2)
    expect(normalized.effects).toEqual(['Первый', 'Второй'])
  })
})
