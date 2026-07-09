/**
 * D&D progression — "what does this race/class grant?" derived from ability
 * items, not from a stored progression array.
 *
 * Race/class abilities (handbook types 3/4) carry their own binding in
 * `data`: `class_id`/`subclass_id` + `level` (type 4) and `race_id`/`subrace_id`
 * + `level` (type 3). This module filters a pool of ability items by a
 * character's chosen race/class/subrace/subclass and a level.
 *
 * The same query powers the create-flow "what you get" panel (level 1) and the
 * future level-up feature (the delta at exactly level N).
 *
 * All functions are pure: pass in the ability items (already fetched), get back
 * a filtered list. Item shape: `{ id, name, data: { level, class_id, ... } }`.
 */

function num(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Owner ids for one axis = union of the single field and the array field, so a
// shared feature (Darkvision across races, Extra Attack across classes) is one
// item with several owners instead of duplicates. Array entries are `{ id }`
// (the `item` field type inside an object_array) or bare ids.
function ownerIds(single, arr) {
  const out = []
  const s = num(single)
  if (s != null) out.push(s)
  ;(Array.isArray(arr) ? arr : []).forEach((e) => {
    const v = num(e?.id ?? e)
    if (v != null && !out.includes(v)) out.push(v)
  })
  return out
}

/**
 * Does one ability item belong to this binding?
 *
 * `binding`: `{ classId?, subclassId?, raceId?, subraceId? }`. Each axis accepts a
 * single id (`class_id`) and/or an array (`class_ids: [{ id }]`); a feature
 * matches if the chosen id is among its owners. A subclass/subrace ability only
 * applies when the matching sub-id is chosen.
 */
export function abilityMatchesBinding(item, binding) {
  const d = item?.data || {}
  const classIds = ownerIds(d.class_id, d.class_ids)
  const raceIds = ownerIds(d.race_id, d.race_ids)

  if (classIds.length) {
    if (!classIds.includes(num(binding.classId))) return false
    const subIds = ownerIds(d.subclass_id, d.subclass_ids)
    if (subIds.length && !subIds.includes(num(binding.subclassId))) return false
    return true
  }

  if (raceIds.length) {
    if (!raceIds.includes(num(binding.raceId))) return false
    const subIds = ownerIds(d.subrace_id, d.subrace_ids)
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
