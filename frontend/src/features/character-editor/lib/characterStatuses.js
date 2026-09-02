import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'

export const STATUS_VALUE_ID = 'states'

function asArray(value) { return Array.isArray(value) ? value : [] }
function entryKey(entry) { return String(entry?.uid || entry?.id || '') }
function sourceLevel(item, values) { return abilityOwnerLevel(item?.data || {}, values || {}) }

function numericScalingValue(item, values) {
  const level = sourceLevel(item, values)
  const row = asArray(item?.data?.scaling)
    .filter(candidate => (Number(candidate?.level) || 0) <= level)
    .sort((left, right) => (Number(right?.level) || 0) - (Number(left?.level) || 0))[0]
  const match = String(row?.value ?? '').replace(',', '.').match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) || 0 : 0
}

export function statusEffectId(value) {
  const raw = value?.effect_id ?? value?.effectId ?? value?.effect?.id ?? value?.effect ?? value?.id
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export function statusEffectLinks(item) {
  return asArray(item?.data?.status_effects).flatMap((link, index) => {
    const effectId = statusEffectId(link)
    if (effectId == null) return []
    return [{ ...link, effect_id: effectId, key: String(link?.key || effectId || index) }]
  })
}

export function normalizeStatusInstances(value) {
  return asArray(value).flatMap((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return []
    const effectId = statusEffectId(row)
    if (effectId == null) return []
    return [{
      ...row,
      uid: String(row.uid || `status-${effectId}-${index}`),
      effect_id: effectId,
      params: row.params && typeof row.params === 'object' && !Array.isArray(row.params) ? row.params : {},
      source: row.source && typeof row.source === 'object' && !Array.isArray(row.source) ? row.source : { kind: 'manual' },
    }]
  })
}

export function statusItemIds(values) {
  return [...new Set(normalizeStatusInstances(values?.[STATUS_VALUE_ID]).map(row => String(row.effect_id)))]
}

function resolvedParameters(link, sourceItem, values) {
  const params = { ...(link?.params || {}) }
  for (const binding of asArray(link?.parameter_bindings)) {
    const key = String(binding?.key || '').trim()
    if (!key) continue
    if (binding.source === 'scaling_value') params[key] = numericScalingValue(sourceItem, values)
    else if (binding.value != null) params[key] = binding.value
  }
  return params
}

function makeUid(effectId) {
  return `status-${effectId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function effectBlocksActivity(effect, activity) {
  return asArray(effect?.data?.derived_effects).some(rule => (
    rule?.kind === 'activity_block' && asArray(rule.scopes).includes(activity)
  ))
}

function sameSource(left, right) {
  return ['kind', 'item_id', 'value_id', 'entry_key', 'link_key']
    .every(key => String(left?.[key] ?? '') === String(right?.[key] ?? ''))
}

export function createStatusInstance(effect, options = {}) {
  const effectId = Number(effect?.id ?? options.effect_id)
  if (!Number.isFinite(effectId)) return null
  const source = { kind: 'manual', ...(options.source || {}) }
  const duration = options.duration || effect?.data?.duration || { kind: 'manual' }
  const initialLevel = Math.max(0, Number(effect?.data?.level) || 0)
  return {
    uid: makeUid(effectId),
    effect_id: effectId,
    source,
    params: { ...(initialLevel > 0 ? { level: initialLevel } : {}), ...(options.params || {}) },
    duration,
    concentration: options.concentration ?? !!effect?.data?.concentration,
  }
}

export function addStatusInstance(values, effect, options = {}) {
  let current = normalizeStatusInstances(values?.[STATUS_VALUE_ID])
  const next = createStatusInstance(effect, options)
  if (!next) return current
  if (next.concentration || effectBlocksActivity(effect, 'concentration')) {
    current = current.filter(row => !row.concentration)
  }
  const multiple = effect?.data?.stacking === 'multiple'
  if (!multiple && current.some(row => row.effect_id === next.effect_id)) return current
  return [...current, next]
}

export function removeStatusInstance(values, uid) {
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).filter(row => row.uid !== String(uid))
}

export function setStatusInstanceLevel(values, uid, level) {
  const nextLevel = Math.max(1, Math.floor(Number(level) || 1))
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).map(row => (
    row.uid === String(uid)
      ? { ...row, params: { ...row.params, level: nextLevel } }
      : row
  ))
}

export function statusEffectActive(values, effect) {
  const effectId = statusEffectId(effect)
  return effectId != null && normalizeStatusInstances(values?.[STATUS_VALUE_ID])
    .some(row => row.effect_id === effectId)
}

export function removeStatusInstancesByEffect(values, effect) {
  const effectId = statusEffectId(effect)
  if (effectId == null) return normalizeStatusInstances(values?.[STATUS_VALUE_ID])
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).filter(row => row.effect_id !== effectId)
}

export function removeStatusInstancesByParam(values, key, value) {
  const parameter = String(key || '').trim()
  if (!parameter) return normalizeStatusInstances(values?.[STATUS_VALUE_ID])
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).filter(row => (
    String(row.params?.[parameter] ?? '') !== String(value ?? '')
  ))
}

export function statusInstanceActiveByParam(values, effect, key, value) {
  const effectId = statusEffectId(effect)
  const parameter = String(key || '').trim()
  if (effectId == null || !parameter) return false
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).some(row => (
    row.effect_id === effectId
    && String(row.params?.[parameter] ?? '') === String(value ?? '')
  ))
}

export function removeStatusesBySource(values, source = {}) {
  const keys = ['kind', 'item_id', 'value_id', 'entry_key']
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).filter(row => (
    !keys.every(key => String(row.source?.[key] ?? '') === String(source?.[key] ?? ''))
  ))
}

export function linkedStatusSource(item, link, source = {}) {
  return {
    kind: source.kind || 'ability',
    item_id: item?.id ?? source.item_id ?? null,
    value_id: source.value_id || '',
    entry_key: source.entry_key || '',
    link_key: String(link?.key || statusEffectId(link) || ''),
    label: source.label || item?.name || '',
  }
}

export function linkedStatusActive(values, item, link, source = {}) {
  const wanted = linkedStatusSource(item, link, source)
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).some(row => (
    row.effect_id === statusEffectId(link) && sameSource(row.source, wanted)
  ))
}

export function toggleLinkedStatus(values, effect, sourceItem, link, source = {}) {
  const wanted = linkedStatusSource(sourceItem, link, source)
  const current = normalizeStatusInstances(values?.[STATUS_VALUE_ID])
  const existing = current.find(row => row.effect_id === statusEffectId(link) && sameSource(row.source, wanted))
  if (existing) return current.filter(row => row.uid !== existing.uid)
  return addStatusInstance(values, effect, {
    source: wanted,
    params: resolvedParameters(link, sourceItem, values),
    duration: link?.duration,
    concentration: link?.concentration,
  })
}

export function collectCharacterStatuses(values, itemsById) {
  return normalizeStatusInstances(values?.[STATUS_VALUE_ID]).flatMap(instance => {
    const item = itemsById.get(String(instance.effect_id))
    if (!item) return []
    return [{
      ...instance,
      item,
      title: item.name || 'Эффект',
      description: item.data?.desc || item.data?.description || '',
      polarity: item.data?.polarity || 'neutral',
      color: item.data?.color || (item.data?.polarity === 'negative' ? 'var(--danger)' : item.data?.polarity === 'positive' ? 'var(--success)' : 'var(--info)'),
    }]
  })
}

export function collectStatusDerivedEffects(values, itemsById) {
  return collectCharacterStatuses(values, itemsById).flatMap(status => (
    asArray(status.item.data?.derived_effects).flatMap((rule, index) => {
      if (!rule?.kind) return []
      const parameter = String(rule.value_parameter || '').trim()
      const targetParameter = String(rule.target_parameter || '').trim()
      return [{
        ...rule,
        ...(parameter ? { value: Number(status.params?.[parameter]) || 0 } : {}),
        ...(targetParameter ? { target_ids: [status.params?.[targetParameter]].filter(value => value != null && value !== '') } : {}),
        key: `status:${status.uid}:derived:${index}`,
        source_label: status.title,
        source_entry: {},
        source_status: status,
      }]
    })
  ))
}

export function collectStatusDefenses(values, itemsById) {
  return collectCharacterStatuses(values, itemsById).flatMap(status => (
    asArray(status.item.data?.defenses).flatMap((rule, index) => {
      const damageType = Number(rule?.damage_type)
      if (!Number.isFinite(damageType)) return []
      return [{
        key: `status:${status.uid}:defense:${index}`,
        damage_type: damageType,
        kind: rule.kind || 'resistance',
        readonly: true,
        source_label: `эффект «${status.title}»`,
        source: { sourceId: 'statuses', entryKey: status.uid, itemId: status.effect_id },
      }]
    })
  ))
}

export function ownedAbilityStatusSource(valueId, entry, item) {
  return {
    kind: 'ability',
    item_id: item?.id ?? entry?.id ?? null,
    value_id: valueId,
    entry_key: entryKey(entry),
    label: item?.name || '',
  }
}
