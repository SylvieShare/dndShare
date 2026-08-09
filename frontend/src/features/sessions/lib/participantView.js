/**
 * Resolve a session participant's display fields (name / avatar / subtitle /
 * level / hp / ac) from its character `data`.
 *
 * Single source of truth = the per-setting **accessors** (hardcoded code in
 * `settings/<system>/accessors.js`), resolved from the participant's template.
 * The legacy DB `path_values_for_list` (`entry.pathValues`) is a fallback for
 * settings without accessors (e.g. VTM). This replaces the old
 * `getByPath(data, pathValues.*)` reads scattered across the session UI, so
 * `path_values_for_list` can be NULL for accessor-backed settings.
 *
 * `entry` is anything carrying `{ templateId, data, pathValues? }` — a session
 * participant or a joinable character.
 */
import { settingAccessors } from '@/features/character-editor/settings'
import { hitDiceTotal, hitDiceUsed, normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { useTemplateStore } from '@/stores/template'

function getByPath(obj, path) {
  if (!obj || !path) return undefined
  return String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

function toStr(v) {
  return v == null || typeof v === 'object' ? '' : String(v)
}

function tplOf(entry) {
  return useTemplateStore().byId(entry?.templateId)
}
function accessorsFor(entry) {
  // Identity is resolved from the template's `name` (settings/index.js); pass
  // the whole template, not its (possibly empty) DB schema.
  return settingAccessors(tplOf(entry))
}
// Legacy path map: prefer one carried on the entry (session participant brief),
// else the template's DB `path_values_for_list` (joinable char shape).
function pvMap(entry) {
  return entry?.pathValues ?? tplOf(entry)?.pathValuesForList ?? {}
}

export function pvName(entry) {
  const a = accessorsFor(entry)
  if (a) return a.displayName(entry?.data) || ''
  return toStr(getByPath(entry?.data ?? {}, pvMap(entry).name))
}

export function pvAvatar(entry) {
  const a = accessorsFor(entry)
  if (a) return a.avatar(entry?.data)
  const v = getByPath(entry?.data ?? {}, pvMap(entry).ava)
  return (v && typeof v === 'string' && v.trim()) ? v : null
}

export function pvSubtitle(entry) {
  const a = accessorsFor(entry)
  if (a) return a.subtitle(entry?.data)
  const pv = pvMap(entry)
  return [getByPath(entry?.data ?? {}, pv.who_1), getByPath(entry?.data ?? {}, pv.who_2)]
    .map(toStr).filter(Boolean).join(' · ')
}

export function pvLevel(entry) {
  const a = accessorsFor(entry)
  if (a) return a.level(entry?.data)
  return toStr(getByPath(entry?.data ?? {}, pvMap(entry).lvl))
}

export function pvHp(entry) {
  const a = accessorsFor(entry)
  const v = a ? a.hp(entry?.data) : getByPath(entry?.data ?? {}, pvMap(entry).hp)
  if (!v || typeof v !== 'object') return null
  const hitDice = normalizeHitDice(v)
  return {
    current: Number(v.current) || 0,
    max: Number(v.max) || 0,
    temp: Number(v.temp) || 0,
    hitDice,
    dice: hitDice[0].die,
    diceCount: hitDiceTotal(hitDice),
    diceUsed: hitDiceUsed(hitDice),
    ds_success: Number(v.ds_success) || 0,
    ds_failure: Number(v.ds_failure) || 0,
  }
}

export function pvAc(entry) {
  const a = accessorsFor(entry)
  if (a) return a.ac(entry?.data)
  const armor = getByPath(entry?.data ?? {}, pvMap(entry).armor)
  if (!armor || typeof armor !== 'object') return null
  const base = Number(armor.ac) || 0
  const shield = armor.shield ? (Number(armor.shield_bonus) || 0) : 0
  const bonuses = Array.isArray(armor.bonuses) ? armor.bonuses.reduce((s, b) => s + (Number(b) || 0), 0) : 0
  return base + shield + bonuses
}

/** Data path for writing player HP back (`<path>.current`, …). */
export function pvHpPath(entry) {
  const a = accessorsFor(entry)
  return (a && a.hpPath) || pvMap(entry).hp || null
}
