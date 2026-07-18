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

function str(val) {
  if (val == null) return ''
  // Race/class may be a `{ id, name }` reference (item-id binding) or a legacy
  // plain string. Resolve the display name from the object, fall back to string.
  if (typeof val === 'object') return String(val.name ?? val.value ?? val.title ?? '')
  return String(val)
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
    return str(data?.values?.name)
  },

  avatar(data) {
    const ava = data?.values?.ava
    if (typeof ava === 'string') return ava || null
    return ava?.url || null
  },

  race(data) {
    return str(data?.values?.race)
  },

  charClass(data) {
    return str(data?.values?.class)
  },

  subtitle(data) {
    return [this.race(data), this.charClass(data)].filter(Boolean).join(' · ')
  },

  level(data) {
    const lvl = data?.values?.lvl
    // BLOCK_LVL stores `{ level, exp }` (see DndLvlView).
    if (lvl && typeof lvl === 'object') return lvl.level ?? lvl.lvl ?? lvl.v ?? ''
    return lvl ?? ''
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
    const base = Number(armor.ac) || 0
    const shield = armor.shield ? (Number(armor.shield_bonus) || 0) : 0
    return base + shield + sumBonuses(armor.bonuses)
  },

  initiativeBonus(data) {
    const raw = data?.values?.initiative
    if (raw == null) return 0
    if (typeof raw === 'number') return raw
    if (typeof raw === 'object') {
      const dex = raw.use_dex ? (abilityModByPath(data?.values, 'values.DEX.mod') || 0) : 0
      if (Number.isFinite(Number(raw.value))) return Number(raw.value) + dex
      return (Number(raw.base) || 0) + sumBonuses(raw.bonuses, b => b?.value) + dex
    }
    return Number(raw) || 0
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
      if (raw && typeof raw === 'object') {
        const v = raw.value
        if (v && typeof v === 'object') {
          score = (Number(v.base) || 0) + sumBonuses(v.bonuses, b => b?.value)
        } else if (v != null) {
          score = Number(v) || 0
        }
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
