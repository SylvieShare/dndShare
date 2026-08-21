import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STANDARD_ARRAY, STATS } from '@/features/character-list/composables/dndCreateWizardStats'
import { createDndWizardState, serializeDndWizardState } from '@/features/character-list/composables/dndCreateWizardState'

const source = readFileSync(fileURLToPath(new URL('./StepStats.vue', import.meta.url)), 'utf8')

vi.mock('@/stores/suggest', () => ({
  useSuggestStore: () => ({ ensure: vi.fn(), items: () => [], loaded: () => false }),
}))

const { useDndCreateWizard } = await import('@/features/character-list/composables/useDndCreateWizard')

describe('D&D ability scores', () => {
  it('resets an earlier distribution, initializes point buy at 8 and remembers the roll', () => {
    const wizard = useDndCreateWizard()
    wizard.state.scores = Object.fromEntries(STATS.map((stat) => [stat, 15]))
    wizard.state.rollPool = [18, 16, 14, 12, 10, 8]
    wizard.state.rollSeries = [{ total: 18, dice: [] }]

    wizard.setMethod('pointbuy')

    expect(wizard.state.rollPool).toEqual([18, 16, 14, 12, 10, 8])
    expect(wizard.state.rollSeries).toEqual([{ total: 18, dice: [] }])
    expect(wizard.state.scores).toEqual(Object.fromEntries(STATS.map((stat) => [stat, 8])))
  })

  it('persists an unassigned roll pool in the wizard draft', () => {
    const state = createDndWizardState()
    state.statMethod = 'roll'
    state.rollPool = [16, 14, 14, 12, 11, 8]
    state.rollSeries = [{ total: 16, dice: [{ id: 0, value: 6, dropped: false }] }]

    const saved = serializeDndWizardState(state)

    expect(Object.values(saved.scores)).toEqual([null, null, null, null, null, null])
    expect(saved.rollPool).toEqual(state.rollPool)
    expect(saved.rollSeries).toEqual(state.rollSeries)
  })

  it('quick build assigns every value from the standard array', () => {
    const wizard = useDndCreateWizard()
    wizard.quickBuild()

    expect(wizard.state.statMethod).toBe('array')
    expect(Object.values(wizard.state.scores).sort((a, b) => b - a)).toEqual(STANDARD_ARRAY)
  })

  it('shows quick build only for the standard array and puts roll in the same toolbar slot', () => {
    expect(source).toContain('<button v-if="state.statMethod === \'array\'" type="button" class="qb"')
    expect(source).toContain('<button v-else-if="state.statMethod === \'roll\'" type="button" class="roll-btn"')
    expect(source).not.toContain('class="roll-cta"')
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
    expect(source).toContain(':model-value="selectedPoolValue(s)"')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('.stat:focus-within { z-index: 20; }')
    expect(source).toContain('.vs-option:first-of-type')
    expect(source).toContain('value: `${value}:${occurrence}`')
    expect(source).toContain('key: `${stat}-${value}-${occurrence}`')
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

  it('renders larger real die faces and reuses the shared roll animation', () => {
    expect(source).toContain("from '@/shared/composables/useDiceRollAnimation'")
    expect(source).toContain('useDiceRollAnimation({ shouldAnimate: shouldAnimateDice })')
    expect(source).toContain(':value="displayedDieValue(seriesIndex, dieIndex, die.value)"')
    expect(source).toContain(':size="32"')
    expect(source).toContain('@keyframes stats-die-tumble')
    expect(source).not.toContain('<i>{{ die.value }}</i>')
  })
})
