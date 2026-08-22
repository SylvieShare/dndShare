/**
 * D&D 5e semantic accessors — the single source of truth for "where does a
 * D&D character keep its name / avatar / hp / ac / initiative / states".
 *
 * Consumed by the character sheet, the character list card, and the session
 * encounter. Replaces the per-template `pathValues` config and the runtime
 * `schema.blocks` scanning that used to live in those places.
 *
 * Every function takes the character `data` object (`{ values, var }`).
 */

import { abilityModByPath, abilityModifier } from '@/shared/lib/dnd'

function refName(val) {
  return val && typeof val === 'object' ? String(val.name || '') : ''
}

function sumBonuses(list, pick) {
  if (!Array.isArray(list)) return 0
  return list.reduce((acc, item) => acc + (Number(pick ? pick(item) : item) || 0), 0)
}

export const dndAccessors = {
  system: 'dnd5e',

  // Data-path ids reused by the session encounter when it patches a player's
  // character data (`values.<id>`).
  initiativeBlockId: 'initiative',
  states: { blockId: 'states', suggestId: 9 },
  // Write-back path for player HP (the encounter patches `<hpPath>.current` etc.).
  hpPath: 'values.hp',

  displayName(data) {
    return String(data?.values?.name || '')
  },

  avatar(data) {
    return data?.values?.ava?.url || null
  },

  race(data) {
    return refName(data?.values?.race)
  },

  charClass(data) {
    const entries = Array.isArray(data?.values?.classes) ? data.values.classes : []
    return entries.map(refName).filter(Boolean).join(' / ')
  },

  subtitle(data) {
    return [this.race(data), this.charClass(data)].filter(Boolean).join(' · ')
  },

  level(data) {
    return data?.values?.lvl?.level ?? ''
  },

  hp(data) {
    const v = data?.values?.hp
    if (!v || typeof v !== 'object') return null
    return {
      current: Number(v.current) || 0,
      max: Number(v.max) || 0,
      temp: Number(v.temp) || 0,
      ds_success: Number(v.ds_success) || 0,
      ds_failure: Number(v.ds_failure) || 0,
    }
  },

  ac(data) {
    const armor = data?.values?.armor
    if (!armor || typeof armor !== 'object') return null
    // Compact consumers do not hydrate handbook items. They can always show
    // the canonical unarmored value; the full sheet and print view replace it
    // with the equipped-item calculation once the catalogue rows are loaded.
    const dex = abilityModByPath(data?.values, 'values.DEX.mod') || 0
    return 10 + dex + sumBonuses(armor.bonuses)
  },

  initiativeBonus(data) {
    const raw = data?.values?.initiative
    if (!raw || typeof raw !== 'object') return 0
    const dex = raw.use_dex ? (abilityModByPath(data?.values, 'values.DEX.mod') || 0) : 0
    return (Number(raw.base) || 0) + sumBonuses(raw.bonuses, b => b?.value) + dex
  },

  statesValue(data) {
    const v = data?.values?.states
    return Array.isArray(v) ? v : []
  },

  // The six ability scores in canonical order. `titleSuggestId` / `suggestTypeId`
  // point at the suggest entry that owns each ability's icon + color (the same
  // ids the DND_CHAR_STAT_10 blocks use for their titles), so the list card can
  // render the radar-chart axis icons without re-deriving them from the schema.
  abilities(data) {
    const SPEC = [
      { id: 'STR', titleSuggestId: 1 },
      { id: 'DEX', titleSuggestId: 2 },
      { id: 'CON', titleSuggestId: 3 },
      { id: 'INT', titleSuggestId: 4 },
      { id: 'WIS', titleSuggestId: 5 },
      { id: 'CHA', titleSuggestId: 6 },
    ]
    return SPEC.map(({ id, titleSuggestId }) => {
      const raw = data?.values?.[id]
      let score = 10
      if (raw?.value && typeof raw.value === 'object') {
        score = (Number(raw.value.base) || 0) + sumBonuses(raw.value.bonuses, b => b?.value)
      }
      return { id, titleSuggestId, suggestTypeId: 16, score, mod: abilityModifier(score) }
    })
  },

  // Header / list display bundle.
  headerTitle(data) {
    return [this.displayName(data), this.race(data), this.charClass(data)]
      .filter(Boolean)
      .join(' • ')
  },

  listFields(data) {
    return {
      name: this.displayName(data) || '(без имени)',
      avatar: this.avatar(data),
      who: this.subtitle(data),
      lvl: this.level(data),
      hp: this.hp(data),
      ac: this.ac(data),
    }
  },
}
