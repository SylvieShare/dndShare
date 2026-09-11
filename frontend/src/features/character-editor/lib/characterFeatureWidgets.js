import { weaponDamageDiceCount } from '@/shared/lib/abilityProgression'
import { FEATURE_VALUE_IDS, featureEntries } from './characterMagicItems'
import { abilityLevelContext } from '@/shared/lib/abilityLevelSource'
import { featureEntryActive } from './featureEntryState'
import { ownedAbilityStatusSource, linkedStatusActive, statusEffectActive, statusEffectLinks } from './characterStatuses'

const VALUE_IDS = FEATURE_VALUE_IDS

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

function currentScaling(data, level) {
  return (Array.isArray(data?.scaling) ? data.scaling : [])
    .filter(row => Math.max(0, Number(row?.level) || 0) <= level)
    .sort((left, right) => (Number(right.level) || 0) - (Number(left.level) || 0))[0] || null
}

function featureDice(definition, data, level) {
  const rule = (data?.weapon_damage || []).find(rule => rule.key && rule.key === definition.weapon_damage_key)
  if (!rule) return { value: '', dice: null, unavailable: 'Правило урона не выбрано или удалено' }
  if (level < Math.max(1, Number(rule.level) || 1)) return { value: '', dice: null }
  const scaled = weaponDamageDiceCount(rule, level)
  const rawDie = String(rule.dice || '').trim()
  const sides = Number(rawDie.replace(/^d/i, '')) || null
  const die = rawDie.replace(/^d/i, 'к')
  return scaled > 0 && die
    ? { value: `${scaled}${die}`, dice: sides ? { count: scaled, sides, label: rawDie } : null }
    : { value: '', dice: null }
}

function widgetValue(definition, data, level) {
  if (definition.value_source === 'weapon_damage') return featureDice(definition, data, level)
  if (definition.value_source === 'scaling') return { value: String(currentScaling(data, level)?.value || ''), dice: null }
  return { value: String(definition.value || ''), dice: null }
}

export function collectCharacterFeatureWidgets(values, itemsById, resources = []) {
  const parts = VALUE_IDS.flatMap(valueId => featureEntries(values, valueId, itemsById).flatMap(entry => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item) return []
    const { level, missingClass } = abilityLevelContext(item.data || {}, values)
    const definitions = Array.isArray(item.data?.sheet_widgets) ? item.data.sheet_widgets : []
    return definitions.flatMap((definition, index) => {
      if (!missingClass && level < Math.max(1, Number(definition?.level) || 1)) return []
      const stateKey = String(definition.key || `${valueId}:${entryKey(entry)}:${index}`)
      const key = valueId === 'magic_items' ? `magic:${entryKey(entry)}:${stateKey}` : stateKey
      const resolvedResource = resources.find(row => (
        row.source?.valueId === valueId
        && row.source?.entryKey === entryKey(entry)
        && (!definition.resource_key || row.source?.resourceKey === definition.resource_key)
      )) || null
      const scaling = currentScaling(item.data || {}, level)
      const metric = missingClass ? { value: '', dice: null, unavailable: 'Нет нужного класса' } : widgetValue(definition, item.data || {}, level)
      const resource = resolvedResource || (definition.kind === 'toggle' && Number(scaling?.uses) === 0
        ? { value: '∞', total: '∞', unlimited: true }
        : null)
      const statusEffectLink = statusEffectLinks(item).filter(link => link.target !== 'other')
        .find(link => String(link.key) === String(definition.status_effect_key || '')) || null
      const statusSource = ownedAbilityStatusSource(valueId, entry, item)
      return [{
        key,
        kind: definition.kind || 'metric',
        title: definition.title || item.name || 'Способность',
        description: definition.description || '',
        details: (Array.isArray(definition.details) ? definition.details : [])
          .map(value => String(value || '').trim())
          .filter(Boolean),
        tone: definition.tone || 'accent',
        value: metric.value,
        unavailable: metric.unavailable || '',
        dice: metric.dice,
        active_label: definition.active_label || 'Активно',
        inactive_label: definition.inactive_label || 'Активировать',
        priority: Number(definition.priority) || 0,
        value_id: valueId,
        entry_key: entryKey(entry),
        state_key: stateKey,
        active: statusEffectLink
          ? (valueId === 'magic_items' ? linkedStatusActive(values, item, statusEffectLink, statusSource) : statusEffectActive(values, statusEffectLink))
          : !!entry.widget_states?.[stateKey],
        status_effect_link: statusEffectLink,
        status_source: statusSource,
        resource: missingClass ? null : resource,
        item,
      }]
    })
  }))

  const groups = new Map()
  for (const part of parts.sort((left, right) => left.priority - right.priority)) {
    const current = groups.get(part.key)
    if (!current) {
      groups.set(part.key, { ...part, notes: part.kind === 'note' ? [part] : [] })
      continue
    }
    if (part.kind !== 'note' && current.kind === 'note') {
      groups.set(part.key, { ...part, notes: current.notes })
    } else {
      current.notes.push(part)
    }
  }
  return [...groups.values()]
}

/** Resources with controls inside visible panels do not need a second sheet row. */
export function featureWidgetResourceKeys(values, itemsById, resources = []) {
  return new Set(collectCharacterFeatureWidgets(values, itemsById, resources)
    .map(widget => widget.resource?.key)
    .filter(Boolean)
    .map(String))
}
