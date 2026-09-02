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
  it('keeps class tabs and recovery-based slot pools separate', () => {
    expect(source).toContain('computeSpellSlotPools')
    expect(source).toContain(':active-slot-pools="activeSlotPools"')
    expect(source).toContain('tabs: tabs.value.map')
    expect(source).toContain('grants: grants.value.map')
    expect(cardSource).toContain("option.pool === 'short_rest'")
  })

  it('uses the same tabs UI for zero, one and several sources', () => {
    expect(source).toContain('v-for="tab in spellTabs"')
    expect(source).toContain('class="sp-tab-add"')
    expect(source).toContain('v-if="!tabs.length"')
    expect(source).toContain('class="sp-standalone"')
    expect(source.indexOf(':show-stats="false"')).toBeLessThan(source.indexOf('aria-label="Источники магии"'))
  })

  it('stores name, class association, mode, ability and bonuses per tab', () => {
    expect(source).toContain('class_item_id: tab.class_item_id')
    expect(source).toContain('casting_ability: tab.casting_ability')
    expect(source).toContain('mode: tab.mode')
    expect(settingsSource).toContain('label="Название"')
    expect(settingsSource).toContain('label="Класс"')
    expect(settingsSource).toContain('label="Режим"')
    expect(settingsSource).toContain('v-if="showCastingConfig" title="Базовая характеристика"')
  })

  it('reads only the canonical spellbook contract at runtime', () => {
    expect(source).toContain('normalizedSpellTabs(raw.tabs)')
    expect(source).toContain('Array.isArray(raw.grants)')
    expect(source).not.toContain('source_settings')
    expect(source).not.toContain('spellcasting_source')
    expect(source).not.toContain('external_only')
  })
})
