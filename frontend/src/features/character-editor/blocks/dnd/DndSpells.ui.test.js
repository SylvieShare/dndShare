import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndSpells.vue', import.meta.url)), 'utf8')
const cardSource = readFileSync(fileURLToPath(new URL('./components/SpellCard.vue', import.meta.url)), 'utf8')

describe('spellcasting restrictions', () => {
  it('combines armor and active-effect restrictions in one notice', () => {
    expect(source).toContain('class="sp-casting-warning"')
    expect(source).toContain("activityBlocks?.('spellcasting')")
    expect(source).toContain('v-for="restriction in spellcastingRestrictions"')
    expect(source).toContain('if (spellcastingBlocked.value && !active) return')
    expect(source).not.toContain('sp-armor-warning')
  })

  it('uses a source-neutral disabled action label', () => {
    expect(cardSource).toContain("ctx.spellcastingBlocked ? 'Сотворение недоступно'")
    expect(cardSource).toContain('ctx.spellcastingBlocked && !ctx.statusEffectActive(entry, link)')
    expect(cardSource).not.toContain('Запрещено доспехом')
  })
})

describe('multiclass spellcasting UI', () => {
  it('keeps class sources and Pact Magic separate', () => {
    expect(source).toContain('characterSpellcastingSources')
    expect(source).toContain('computeSpellSlotPools')
    expect(source).toContain(':pact-slot="pactSlot"')
    expect(source).toContain('spellcasting_source')
    expect(cardSource).toContain('Класс заклинания не указан')
    expect(cardSource).toContain("option.pool === 'pact'")
  })
})
