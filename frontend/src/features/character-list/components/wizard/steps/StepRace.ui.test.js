import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepRace.vue', import.meta.url)), 'utf8')

describe('race step hierarchy', () => {
  it('uses an expressive page heading without changing its concise label', () => {
    expect(source).toContain('<h1 class="race-step-title">Раса</h1>')
    expect(source).toContain('font-family: var(--font-display)')
  })

  it('separates race choices and emphasizes ability-score selection', () => {
    expect(source).toContain('class="choice-stack"')
    expect(source).toContain('class="choice-block choice-block--asi"')
    expect(source).toContain('class="choice-count"')
    expect(source).toContain('grid-template-columns: repeat(6, minmax(0, 1fr))')
  })
})
