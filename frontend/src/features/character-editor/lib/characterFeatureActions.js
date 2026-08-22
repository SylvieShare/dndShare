import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

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

function matchingResource(resources, valueId, ownedEntry, definition) {
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
  return ABILITY_VALUE_IDS.flatMap(valueId => (
    Array.isArray(values?.[valueId]) ? values[valueId] : []
  ).flatMap(ownedEntry => {
    if (!featureEntryActive(valueId, ownedEntry)) return []
    const item = itemsById.get(String(ownedEntry.id))
    if (!item) return []
    const ownerLevel = abilityOwnerLevel(item.data || {}, values)
    const definitions = Array.isArray(item.data?.feature_actions) ? item.data.feature_actions : []
    return definitions.flatMap((definition, index) => {
      if (ownerLevel < Math.max(1, Number(definition?.level) || 1)) return []
      return [{
        key: `feature:${valueId}:${entryKey(ownedEntry)}:${definition.key || index}`,
        title: String(definition.title || item.name || 'Действие'),
        action_type: actionType(definition.action_type),
        description: String(definition.description || ''),
        requirements: requirements(definition.requirements),
        priority: Number(definition.priority) || 0,
        resource_cost: Math.max(1, Number(definition.resource_cost) || 1),
        resource: matchingResource(resources, valueId, ownedEntry, definition),
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
    priority: Number(entry.priority) || index,
    resource: null,
    readonly: false,
    source_label: '',
    item: null,
  }))
}

export function collectCharacterFeatureActions(values, itemsById, resources = []) {
  return [...manualActions(values), ...contributedActions(values, itemsById, resources)]
    .sort((left, right) => (
      (TYPE_ORDER.get(left.action_type) ?? 99) - (TYPE_ORDER.get(right.action_type) ?? 99)
      || left.priority - right.priority
      || left.title.localeCompare(right.title, 'ru')
    ))
}

export function groupCharacterFeatureActions(actions) {
  return FEATURE_ACTION_TYPES.map(type => ({
    ...type,
    label: type.group_label,
    actions: actions.filter(action => action.action_type === type.value),
  })).filter(group => group.actions.length)
}
