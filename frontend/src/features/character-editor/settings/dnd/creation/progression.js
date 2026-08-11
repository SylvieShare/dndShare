/**
 * D&D progression — "what does this race/class grant?" derived from ability
 * items, not from a stored progression array.
 *
 * Race/class abilities (handbook types 3/4) carry their own binding in
 * `data`: `class_ids`/`subclass_ids` + `level` (type 4) and
 * `race_ids`/`subrace_ids` + `level` (type 3). This module filters a pool of ability items by a
 * character's chosen race/class/subrace/subclass and a level.
 *
 * The same query powers the create-flow "what you get" panel (level 1) and the
 * future level-up feature (the delta at exactly level N).
 *
 * All functions are pure: pass in the ability items (already fetched), get back
 * a filtered list. Item shape: `{ id, name, data: { level, class_ids, ... } }`.
 */

function num(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Shared features list every owner as `{ id }` in an object-array field.
function ownerIds(arr) {
  const out = []
  ;(Array.isArray(arr) ? arr : []).forEach((e) => {
    const v = num(e?.id)
    if (v != null && !out.includes(v)) out.push(v)
  })
  return out
}

/**
 * Does one ability item belong to this binding?
 *
 * `binding`: `{ classId?, subclassId?, raceId?, subraceId? }`. Each axis accepts a
 * owner arrays (`class_ids: [{ id }]`); a feature matches if the chosen id is
 * among its owners. A subclass/subrace ability only
 * applies when the matching sub-id is chosen.
 */
export function abilityMatchesBinding(item, binding) {
  const d = item?.data || {}
  const classIds = ownerIds(d.class_ids)
  const raceIds = ownerIds(d.race_ids)

  if (classIds.length) {
    if (!classIds.includes(num(binding.classId))) return false
    const subIds = ownerIds(d.subclass_ids)
    if (subIds.length && !subIds.includes(num(binding.subclassId))) return false
    return true
  }

  if (raceIds.length) {
    if (!raceIds.includes(num(binding.raceId))) return false
    const subIds = ownerIds(d.subrace_ids)
    if (subIds.length && !subIds.includes(num(binding.subraceId))) return false
    return true
  }

  return false
}

/**
 * Ability items granted for a binding up to (cumulative) or exactly at a level.
 *
 * `opts.cumulative` (default true) → all features with `level <= level`.
 * `opts.cumulative === false` → only features gained exactly at `level` (the
 * level-up delta). Items missing `level` are treated as level 1.
 */
export function featuresForBinding(abilityItems, binding, level, opts = {}) {
  const cumulative = opts.cumulative !== false
  const lvl = num(level) ?? 1
  return (abilityItems || []).filter((item) => {
    if (!abilityMatchesBinding(item, binding)) return false
    const at = num(item?.data?.level) ?? 1
    return cumulative ? at <= lvl : at === lvl
  })
}

/** Just the ids of `featuresForBinding`, in stable item order. */
export function featureIdsForBinding(abilityItems, binding, level, opts = {}) {
  return featuresForBinding(abilityItems, binding, level, opts).map((it) => it.id)
}
