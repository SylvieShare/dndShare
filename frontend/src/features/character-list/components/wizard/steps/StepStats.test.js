import { describe, expect, it, vi } from 'vitest'
import { STANDARD_ARRAY, STATS } from '@/features/character-list/composables/dndCreateWizardStats'

vi.mock('@/stores/suggest', () => ({
  useSuggestStore: () => ({ ensure: vi.fn(), items: () => [], loaded: () => false }),
}))

const { useDndCreateWizard } = await import('@/features/character-list/composables/useDndCreateWizard')

describe('D&D ability scores', () => {
  it('resets an earlier distribution and initializes point buy at 8', () => {
    const wizard = useDndCreateWizard()
    wizard.state.scores = Object.fromEntries(STATS.map((stat) => [stat, 15]))
    wizard.state.rollPool = [18, 16, 14, 12, 10, 8]

    wizard.setMethod('pointbuy')

    expect(wizard.state.rollPool).toEqual([])
    expect(wizard.state.scores).toEqual(Object.fromEntries(STATS.map((stat) => [stat, 8])))
  })

  it('quick build assigns every value from the standard array', () => {
    const wizard = useDndCreateWizard()
    wizard.quickBuild()

    expect(wizard.state.statMethod).toBe('array')
    expect(Object.values(wizard.state.scores).sort((a, b) => b - a)).toEqual(STANDARD_ARRAY)
  })
})
