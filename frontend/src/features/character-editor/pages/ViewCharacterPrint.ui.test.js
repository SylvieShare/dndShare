import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(fileURLToPath(new URL('./ViewCharacterPrint.vue', import.meta.url)), 'utf8')
const featureSource = readFileSync(fileURLToPath(new URL('../components/print/PrintFeatureCard.vue', import.meta.url)), 'utf8')
const spellSource = readFileSync(fileURLToPath(new URL('../components/print/PrintSpellCard.vue', import.meta.url)), 'utf8')

describe('character PDF print styles', () => {
  it('prints larger open spell-slot circles', () => {
    expect(pageSource).toContain('.slots-box i { width: 4mm; height: 4mm;')
    expect(pageSource).not.toContain(':class="{ used: i <= slot.used }"')
    expect(pageSource).not.toContain('.slots-box i.used')
  })

  it('renders rich formulas as quiet inline annotations', () => {
    for (const source of [featureSource, spellSource]) {
      expect(source).toContain(':deep(.rich-node)')
      expect(source).toContain('background: #f7f4ed')
      expect(source).toContain('font-weight: 500')
    }
  })

  it('prints casting parameters for every spellcasting source', () => {
    expect(pageSource).toContain('v-for="row in spellcastingSummaries"')
    expect(pageSource).toContain('values.value.spells?.tabs')
    expect(pageSource).toContain('values.value.spells?.grants')
    expect(pageSource).toContain('entry?.casting_ability')
  })
})
