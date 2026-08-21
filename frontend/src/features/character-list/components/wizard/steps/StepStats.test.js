import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STANDARD_ARRAY, STATS } from '@/features/character-list/composables/dndCreateWizardStats'

const source = readFileSync(fileURLToPath(new URL('./StepStats.vue', import.meta.url)), 'utf8')

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

  it('uses a three-column roomy card grid with category-specific score details', () => {
    expect(source).toContain('.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(source).toContain('class="stat-score-row"')
    expect(source).toContain('class="stat-breakdown"')
    expect(source).toContain('class="primary-badge"')
    expect(source).toContain('@media (max-width: 820px)')
    expect(source).toContain('@media (max-width: 460px)')
    expect(source).toContain(':deep(.share-multi-toggle)')
    expect(source).toContain('v-else class="stat-placeholder">?</strong>')
    expect(source).toContain("assigned(s) ? state.scores[s] : '?'")
  })

  it('renders ability icons and colors from suggest type 16', () => {
    expect(source).toContain('suggestStore.items(16)')
    expect(source).toContain('SUGGEST16_TO_STAT[Number(item.id)]')
    expect(source).toContain('<SvgIcon')
    expect(source).toContain(':color="suggestFor(s).color')
  })

  it('uses the shared custom value picker instead of a native select', () => {
    expect(source).toContain('<ValueSelect')
    expect(source).toContain(':options="poolOptions(s)"')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('.stat:focus-within { z-index: 20; }')
    expect(source).toContain('.vs-option:first-of-type')
    expect(source).toContain('доступно ×${count}')
    expect(source).not.toContain('<select')
    expect(source).not.toContain('<span class="ctl-label">Назначить значение</span>')
  })

  it('asks for confirmation before replacing an existing dice pool', () => {
    expect(source).toContain('@click="requestRoll"')
    expect(source).toContain('if (state.rollPool.length) rerollConfirmOpen.value = true')
    expect(source).toContain('<ConfirmDialog')
    expect(source).toContain('поведение, недостойное настоящего героя')
    expect(source).toContain('confirm-label="Да, мне не стыдно"')
  })
})
