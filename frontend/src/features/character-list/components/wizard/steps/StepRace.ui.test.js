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
    expect(source).toContain('<AbilityBonusPicker')
    expect(source).toContain('class="choice-count"')
  })

  it('places the shared subrace picker inside race choices', () => {
    expect(source).toContain('<RaceSubracePicker')
    expect(source.indexOf('<RaceSubracePicker')).toBeGreaterThan(source.indexOf('class="choice-stack"'))
    expect(source).toContain('v-model="state.subrace"')
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
