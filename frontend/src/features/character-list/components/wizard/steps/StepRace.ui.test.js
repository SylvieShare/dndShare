import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepRace.vue', import.meta.url)), 'utf8')

describe('race step hierarchy', () => {
  it('keeps the selected race visible while the catalogue reloads', () => {
    expect(source).toContain(':loading="loading && !races.length && !state.race"')
    expect(source).toContain(':empty="!loading && !races.length && !state.race"')
  })

  it('uses an expressive page heading without changing its concise label', () => {
    expect(source).toContain('<IllustratedChoiceStage')
    expect(source).toContain('title="Раса"')
    expect(source).toContain('back-text="К выбору расы"')
  })

  it('separates race choices and emphasizes ability-score selection', () => {
    expect(source).toContain('class="choice-stack"')
    expect(source).toContain('class="choice-block choice-block--asi"')
    expect(source).toContain('class="choice-count"')
    expect(source).toContain('grid-template-columns: repeat(6, minmax(0, 1fr))')
  })

  it('shows illustrated subraces in a two-column grid', () => {
    expect(source).toContain('<SubraceSelectCard')
    expect(source).toContain(':image-url="s.coverImageUrl || \'\'"')
    expect(source).toContain(':description="s.data?.description || \'\'"')
    expect(source).not.toContain('<RichContent v-if="subraceDesc"')
    expect(source).toContain('.subrace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))')
  })

  it('uses covers rather than icons for race artwork', () => {
    expect(source).toContain(':image-url="raceCoverFor(r)"')
    expect(source).not.toContain('iconImageUrl')
  })

  it('scrolls the selected race details into view on phones', () => {
    expect(source).toContain("window.matchMedia?.('(max-width: 640px)').matches")
    expect(source).toContain("scrollIntoView({ behavior: 'smooth', block: 'start' })")
  })
})
