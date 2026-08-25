import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'
import { collectCharacterStatuses } from './characterStatuses'

export const FEATURE_ACTION_TYPES = [
  { value: 'action', label: 'Действие', group_label: 'Действия' },
  { value: 'bonus_action', label: 'Бонусное действие', group_label: 'Бонусные действия' },
  { value: 'reaction', label: 'Реакция', group_label: 'Реакции' },
  { value: 'free', label: 'Свободное действие', group_label: 'Свободные действия' },
  { value: 'special', label: 'Особое действие', group_label: 'Особые действия' },
]

const TYPE_ORDER = new Map(FEATURE_ACTION_TYPES.map((entry, index) => [entry.value, index]))
const ABILITY_VALUE_IDS = ['abilities_class', 'abilities_race', 'abilities_feats']

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

function requirements(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

function actionType(value) {
  return TYPE_ORDER.has(value) ? value : 'special'
}

function activeStatusCodes(values, itemsById) {
  return new Set(collectCharacterStatuses(values, itemsById)
    .map(status => String(status.item?.data?.code || '').trim())
    .filter(Boolean))
}

function statusRequirementsMet(definition, codes) {
  return requirements(definition?.required_status_codes).every(code => codes.has(code))
}

function menuEffects(values, definitions) {
  return (Array.isArray(definitions) ? definitions : []).flatMap((definition, index) => {
    if (definition?.kind !== 'adjust_counter') return []
    const valueId = String(definition.value_id || '').trim()
    const counterKey = String(definition.counter_key || '').trim()
    if (!valueId || !counterKey) return []
    const container = values?.[valueId]
    const current = Math.floor(Number(container?.[counterKey]) || 0)
    const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : 0
    const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : Number.MAX_SAFE_INTEGER
    const delta = Number(definition.delta) || 0
    const next = Math.max(min, Math.min(max, current + delta))
    return [{
      ...definition,
      key: String(definition.key || `${valueId}:${counterKey}:${index}`),
      title: String(definition.title || 'Применить последствие'),
      value_id: valueId,
      counter_key: counterKey,
      current,
      next,
      min,
      max,
      disabled: next === current,
      suffix: max < Number.MAX_SAFE_INTEGER ? `${current}/${max}` : String(current),
    }]
  })
}

function matchingResource(resources, valueId, ownedEntry, definition) {
  const resourceItemId = Number(definition.resource_item_id)
  if (Number.isFinite(resourceItemId)) {
    return resources.find(resource => (
      Number(resource.item_id) === resourceItemId
      && (!definition.resource_key || resource.source?.resourceKey === definition.resource_key)
    )) || null
  }
  if (!definition.uses_resource && !definition.resource_key) return null
  return resources.find(resource => (
    resource.source?.valueId === valueId
    && resource.source?.entryKey === entryKey(ownedEntry)
    && (definition.resource_key
      ? resource.source?.resourceKey === definition.resource_key
      : !resource.source?.resourceKey)
  )) || null
}

function contributedActions(values, itemsById, resources) {
  const statusCodes = activeStatusCodes(values, itemsById)
  return ABILITY_VALUE_IDS.flatMap(valueId => (
    Array.isArray(values?.[valueId]) ? values[valueId] : []
  ).flatMap(ownedEntry => {
    if (!featureEntryActive(valueId, ownedEntry)) return []
    const item = itemsById.get(String(ownedEntry.id))
    if (!item) return []
    const ownerLevel = abilityOwnerLevel(item.data || {}, values)
    const definitions = Array.isArray(item.data?.feature_actions) ? item.data.feature_actions : []
    return definitions.flatMap((definition, index) => {
      if (ownerLevel < Math.max(1, Number(definition?.level) || 1) || !statusRequirementsMet(definition, statusCodes)) return []
      return [{
        key: `feature:${valueId}:${entryKey(ownedEntry)}:${definition.key || index}`,
        title: String(definition.title || item.name || 'Действие'),
        action_type: actionType(definition.action_type),
        description: String(definition.description || ''),
        requirements: requirements(definition.requirements),
        suggest_action_codes: requirements(definition.suggest_action_codes),
        priority: Number(definition.priority) || 0,
        resource_cost: Math.max(0, Number(definition.resource_cost) || 0),
        resource: matchingResource(resources, valueId, ownedEntry, definition),
        menu_effects: menuEffects(values, definition.menu_effects),
        readonly: true,
        source_label: item.name || 'Способность',
        item,
      }]
    })
  }))
}

function manualActions(values) {
  return (Array.isArray(values?.actions) ? values.actions : []).map((entry, index) => ({
    ...entry,
    key: `manual:${entry.uid || index}`,
    uid: entry.uid || String(index),
    title: String(entry.title || 'Своё действие'),
    action_type: actionType(entry.action_type),
    description: String(entry.description || ''),
    requirements: requirements(entry.requirements),
    suggest_action_codes: [],
    priority: Number(entry.priority) || index,
    resource: null,
    menu_effects: [],
    readonly: false,
    source_label: '',
    item: null,
  }))
}

export function featureActionEffectPatch(values, effect) {
  if (effect?.kind !== 'adjust_counter') return null
  const valueId = String(effect.value_id || '').trim()
  const counterKey = String(effect.counter_key || '').trim()
  if (!valueId || !counterKey) return null
  const container = values?.[valueId]
  const currentValue = container && typeof container === 'object' && !Array.isArray(container) ? container : {}
  const current = Math.floor(Number(currentValue[counterKey]) || 0)
  const min = Number.isFinite(Number(effect.min)) ? Number(effect.min) : 0
  const max = Number.isFinite(Number(effect.max)) ? Number(effect.max) : Number.MAX_SAFE_INTEGER
  const next = Math.max(min, Math.min(max, current + (Number(effect.delta) || 0)))
  if (next === current) return null
  return { [valueId]: { ...currentValue, [counterKey]: next } }
}

export function collectCharacterFeatureActions(values, itemsById, resources = []) {
  const orderedKeys = Array.isArray(values?.action_order) ? values.action_order.map(String) : []
  const order = new Map(orderedKeys.map((key, index) => [key, index]))
  return [...manualActions(values), ...contributedActions(values, itemsById, resources)]
    .sort((left, right) => (
      (TYPE_ORDER.get(left.action_type) ?? 99) - (TYPE_ORDER.get(right.action_type) ?? 99)
      || (order.has(left.key) || order.has(right.key)
        ? (order.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.key) ?? Number.MAX_SAFE_INTEGER)
        : 0)
      || left.priority - right.priority
      || left.title.localeCompare(right.title, 'ru')
    ))
}

export function groupCharacterFeatureActions(actions, includeEmpty = false) {
  return FEATURE_ACTION_TYPES.map(type => ({
    ...type,
    label: type.group_label,
    actions: actions.filter(action => action.action_type === type.value),
  })).filter(group => includeEmpty || group.actions.length)
}
