import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./RaceSelectCard.vue', import.meta.url)), 'utf8')

describe('race select card presentation', () => {
  it('lists named subraces separately from future choices', () => {
    expect(source).toContain('Доступные подрасы')
    expect(source).toContain('v-for="subrace in subraces"')
  })

  it('shows ability descriptions in the shared item tooltip', () => {
    expect(source).toContain('@mouseenter="showAbilityTooltip($event, entry)"')
    expect(source).toContain('<ItemTooltip')
  })

  it('keeps the standard card surface after selection', () => {
    const selectedRule = source.match(/\.race-card--selected \{([^}]+)\}/)?.[1] || ''
    expect(selectedRule).not.toBe('')
    expect(selectedRule).not.toContain('background:')
  })
})
