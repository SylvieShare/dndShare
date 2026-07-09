/**
 * D&D create-flow grant engine.
 *
 * `extractGrants` reads the chosen race/subrace/class/subclass **handbook items**
 * (types 8/9) and normalizes everything they hand the character into one
 * `grants` object. `applyGrants` writes the non-stat parts of that onto a fresh
 * character's `values` (proficiencies, speed, hit dice, saving throws, granted
 * features). Racial ability-score increases (`grants.asi`) are intentionally
 * NOT applied here — they are layered on the chosen ability scores in the stats
 * step.
 *
 * Suggest-typed item fields store suggest **ids** (see HandbookItemDetail), while
 * the character keeps proficiencies as value **strings** — so `applyGrants`
 * needs an injected `suggestValue(typeId, id) -> label` lookup (decoupled from
 * Pinia, so this module stays pure and testable).
 */

import { SUGGEST16_TO_STAT as STAT_BY_SUGGEST16 } from '@/shared/lib/dndStats'

// proficiency bucket -> (character proficiencies key, suggest type id)
const PROF_BUCKETS = {
  armor: { key: 'Доспехи', typeId: 3 },
  weapon: { key: 'Оружие', typeId: 4 },
  tool: { key: 'Инструменты', typeId: 5 },
}
const LANG_TYPE_ID = 6
const DICE_TYPE_ID = 11

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

function num(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function statKey(suggestId) {
  return STAT_BY_SUGGEST16[num(suggestId)] || null
}

function asList(v) {
  return Array.isArray(v) ? v : []
}

// Capture the race-side "pick N" offers (skills / language / feat) from one data
// object (base race, subrace, or a chosen variant option) into grants.
function captureRaceChoices(d, grants) {
  if (d.skill_choice && num(d.skill_choice.count) != null) {
    grants.raceSkillChoice = {
      count: num(d.skill_choice.count),
      from: asList(d.skill_choice.from).map((id) => num(id) ?? id),
    }
  }
  if (d.lang_choice && num(d.lang_choice.count) != null) {
    grants.langChoice = {
      count: num(d.lang_choice.count),
      from: asList(d.lang_choice.from).map((id) => num(id) ?? id),
    }
  }
  if (d.feat_choice && num(d.feat_choice.count) != null) {
    grants.featChoice = { count: num(d.feat_choice.count) }
  }
}

function pushUnique(arr, value) {
  if (value != null && value !== '' && !arr.includes(value)) arr.push(value)
}

function mergeIds(target, ids) {
  asList(ids).forEach((id) => pushUnique(target, num(id) ?? id))
}

/**
 * Normalize the static grants of the chosen race/class (+ sub-selections) into
 * one object. Each argument is a handbook item (`{ data }`) or null. Sub items
 * are merged on top of their base.
 */
export function extractGrants({ race, subrace, charClass, subclass, raceVariant } = {}) {
  const grants = {
    size: null,
    speed: null,
    asi: [],
    asiChoice: null,
    raceVariants: null,
    raceSkillChoice: null,
    langChoice: null,
    featChoice: null,
    saves: [],
    proficiencies: { armor: [], weapon: [], tool: [] },
    languages: [],
    hitDieId: null,
    skillChoice: null,
    spellcasting: null,
    subclassLevel: null,
    asiLevels: null,
  }

  const raceData = [race, subrace].filter(Boolean).map((i) => i.data || {})
  const classData = [charClass, subclass].filter(Boolean).map((i) => i.data || {})

  for (const d of raceData) {
    if (d.size != null && d.size !== '') grants.size = d.size
    if (num(d.speed) != null) grants.speed = num(d.speed)
    for (const row of asList(d.asi)) {
      const stat = statKey(row?.ability)
      const bonus = num(row?.bonus)
      if (stat && bonus != null) grants.asi.push({ stat, bonus })
    }
    // Floating ASI: "choose N abilities, +V each" (e.g. Half-Elf).
    if (d.asi_choice && num(d.asi_choice.count)) {
      grants.asiChoice = { count: num(d.asi_choice.count), bonus: num(d.asi_choice.bonus) ?? 1 }
    }
    // Named race variants ("pick one", e.g. Human Standard / Gifted); each option
    // can carry its own fixed asi and/or floating asi_choice.
    if (Array.isArray(d.variants) && d.variants.length) grants.raceVariants = d.variants
    // Race-side "pick N" offers: extra skills / language / feat (e.g. Half-Elf).
    captureRaceChoices(d, grants)
    mergeIds(grants.languages, d.languages)
    mergeIds(grants.proficiencies.armor, d.armor_prof)
    mergeIds(grants.proficiencies.weapon, d.weapon_prof)
    mergeIds(grants.proficiencies.tool, d.tool_prof)
  }

  // Apply the chosen variant (if any) on top of the base race grants.
  if (grants.raceVariants && raceVariant) {
    const opt = grants.raceVariants.find((o) => o.value === raceVariant)
    if (opt) {
      for (const row of asList(opt.asi)) {
        const stat = statKey(row?.ability)
        const bonus = num(row?.bonus)
        if (stat && bonus != null) grants.asi.push({ stat, bonus })
      }
      if (opt.asi_choice && num(opt.asi_choice.count)) {
        grants.asiChoice = { count: num(opt.asi_choice.count), bonus: num(opt.asi_choice.bonus) ?? 1 }
      }
      // A variant can also carry its own skills / language / feat offers
      // (e.g. Gifted Human → one feat).
      captureRaceChoices(opt, grants)
    }
  }

  for (const d of classData) {
    if (d.hit_die != null) grants.hitDieId = num(d.hit_die)
    asList(d.saves).forEach((id) => {
      const stat = statKey(id)
      if (stat && !grants.saves.includes(stat)) grants.saves.push(stat)
    })
    mergeIds(grants.proficiencies.armor, d.armor_prof)
    mergeIds(grants.proficiencies.weapon, d.weapon_prof)
    mergeIds(grants.proficiencies.tool, d.tool_prof)
    if (d.skill_choice && num(d.skill_choice.count) != null) {
      grants.skillChoice = {
        count: num(d.skill_choice.count),
        from: asList(d.skill_choice.from).map((id) => num(id) ?? id),
      }
    }
    if (d.spellcasting && (statKey(d.spellcasting.ability) || d.spellcasting.cantrips_known != null)) {
      grants.spellcasting = {
        stat: statKey(d.spellcasting.ability),
        cantripsKnown: num(d.spellcasting.cantrips_known) ?? 0,
        spellsKnown: num(d.spellcasting.spells_known) ?? 0,
        prepares: !!d.spellcasting.prepares,
        note: d.spellcasting.note || '',
      }
    }
    if (num(d.subclass_level) != null) grants.subclassLevel = num(d.subclass_level)
    if (d.asi_levels != null && d.asi_levels !== '') grants.asiLevels = d.asi_levels
  }

  return grants
}

function dieFace(label) {
  const m = String(label || '').match(/(\d+)/)
  return m ? Number(m[1]) : null
}

function applyProfBucket(profs, bucketKey, ids, typeId, suggestValue) {
  if (!ids.length) return
  const labels = ids.map((id) => suggestValue?.(typeId, id)).filter((l) => l != null && l !== '')
  if (!labels.length) return
  if (!Array.isArray(profs[bucketKey])) profs[bucketKey] = []
  labels.forEach((l) => pushUnique(profs[bucketKey], l))
}

/**
 * Apply the non-stat grants onto character `values` (mutates a clone, returns
 * it). `opts.suggestValue(typeId, id) -> label` resolves suggest ids; omit it
 * and proficiency/language resolution is skipped. `opts.raceAbilityIds` /
 * `opts.classAbilityIds` are the level-1 granted ability item ids (from
 * `progression.featureIdsForBinding`).
 *
 * Returns `{ values, asi }` — `asi` is handed to the stats step.
 */
export function applyGrants(values, grants, opts = {}) {
  const { suggestValue, raceAbilityIds = [], classAbilityIds = [] } = opts
  const out = clone(values) || {}

  if (grants.speed != null) out.speed = grants.speed

  if (grants.hitDieId != null) {
    const face = dieFace(suggestValue?.(DICE_TYPE_ID, grants.hitDieId)) || dieFace(grants.hitDieId)
    if (face) {
      out.hp = { ...(out.hp || {}), max: face, current: face, diceCount: 1, dice: `d${face}` }
    }
  }

  for (const stat of grants.saves) {
    out[stat] = { ...(out[stat] || {}), save_up: true }
  }

  const profs = { ...(out.proficiencies || {}) }
  applyProfBucket(profs, PROF_BUCKETS.armor.key, grants.proficiencies.armor, PROF_BUCKETS.armor.typeId, suggestValue)
  applyProfBucket(profs, PROF_BUCKETS.weapon.key, grants.proficiencies.weapon, PROF_BUCKETS.weapon.typeId, suggestValue)
  applyProfBucket(profs, PROF_BUCKETS.tool.key, grants.proficiencies.tool, PROF_BUCKETS.tool.typeId, suggestValue)
  applyProfBucket(profs, 'Языки', grants.languages, LANG_TYPE_ID, suggestValue)
  out.proficiencies = profs

  out.abilities_race = asList(raceAbilityIds).map((id) => ({ id }))
  out.abilities_class = asList(classAbilityIds).map((id) => ({ id }))

  return { values: out, asi: grants.asi || [] }
}
