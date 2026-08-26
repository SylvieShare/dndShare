import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndSpells.vue', import.meta.url)), 'utf8')
const cardSource = readFileSync(fileURLToPath(new URL('./components/SpellCard.vue', import.meta.url)), 'utf8')
const settingsSource = readFileSync(fileURLToPath(new URL('./DndSpellbookSettingsModal.vue', import.meta.url)), 'utf8')

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
    expect(source).toContain(':active-slot-pools="activeSlotPools"')
    expect(source).toContain('spellcasting_source')
    expect(cardSource).toContain("option.pool === 'short_rest'")
  })

  it('shows only class tabs and keeps slots plus grants above them', () => {
    expect(source).toContain('v-for="tab in spellTabs"')
    expect(source).not.toContain("{ key: 'all', label: 'Все' }")
    expect(source).not.toContain("{ key: 'other', label: 'Другие' }")
    expect(source).toContain('class="sp-standalone"')
    expect(source.indexOf(':show-stats="false"')).toBeLessThan(source.indexOf('aria-label="Класс заклинаний"'))
    expect(source).toContain('spells.value.filter(spellMatchesActiveTab)')
  })

  it('stores casting ability, bonuses and preparation per active tab', () => {
    expect(source).toContain('source_settings: serializeSpellcastingSettings')
    expect(source).toContain('activeSettingsKey')
    expect(source).toContain("updateActiveCastingSetting('preparation'")
    expect(settingsSource).toContain('v-if="showCastingConfig" title="Подготовка"')
    expect(settingsSource).toContain('v-if="showCastingConfig" title="Базовая характеристика"')
  })

  it('assigns legacy wizard-created spells to a compatible class source', () => {
    expect(source).toContain('assignMissingSpellSources')
    expect(source).toContain('inferredSpellcastingSource')
    expect(source).toContain('classIds.has(String(source.listClassId')
  })
})
