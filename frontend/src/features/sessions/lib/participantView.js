/**
 * Resolve a session participant's display fields (name / avatar / subtitle /
 * level / hp / ac) from its character `data`.
 *
 * Single source of truth = the per-setting **accessors** in
 * `settings/<system>/accessors.js`, resolved from the participant's template.
 *
 * `entry` is anything carrying `{ templateId, data }` — a session participant
 * or a joinable character.
 */
import { settingAccessors } from '@/features/character-editor/settings'
import { normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { hpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'
import { useTemplateStore } from '@/stores/template'

function tplOf(entry) {
  return useTemplateStore().byId(entry?.templateId)
}
function accessorsFor(entry) {
  // Identity is resolved from the template's `name` in settings/index.js.
  return settingAccessors(tplOf(entry))
}
export function pvName(entry) {
  const a = accessorsFor(entry)
  return a?.displayName(entry?.data) || ''
}

export function pvAvatar(entry) {
  if (entry?.iconImageUrl) return entry.iconImageUrl
  const a = accessorsFor(entry)
  return a?.avatar(entry?.data) || null
}

export function pvSubtitle(entry) {
  const a = accessorsFor(entry)
  return a?.subtitle(entry?.data) || ''
}

export function pvLevel(entry) {
  const a = accessorsFor(entry)
  return a?.level(entry?.data) || ''
}

export function pvHp(entry) {
  const a = accessorsFor(entry)
  const v = a?.hp(entry?.data)
  if (!v || typeof v !== 'object') return null
  const hitDice = normalizeHitDice(v)
  return {
    current: Number(v.current) || 0,
    max: hpMaximum(v),
    temp: Number(v.temp) || 0,
    hitDice,
    ds_success: Number(v.ds_success) || 0,
    ds_failure: Number(v.ds_failure) || 0,
  }
}

export function pvAc(entry) {
  const a = accessorsFor(entry)
  return a?.ac(entry?.data) ?? null
}

/** Data path for writing player HP back (`<path>.current`, …). */
export function pvHpPath(entry) {
  const a = accessorsFor(entry)
  return a?.hpPath || null
}
