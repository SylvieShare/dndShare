import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

const VALUE_IDS = ['abilities_feats', 'abilities_race', 'abilities_class']

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

function currentScaling(data, level) {
  return (Array.isArray(data?.scaling) ? data.scaling : [])
    .filter(row => Math.max(0, Number(row?.level) || 0) <= level)
    .sort((left, right) => (Number(right.level) || 0) - (Number(left.level) || 0))[0] || null
}

function featureDice(data, level) {
  const rule = (Array.isArray(data?.weapon_damage) ? data.weapon_damage : [])[0]
  if (!rule) return { value: '', dice: null }
  const fixed = Math.max(0, Number(rule.dice_count) || 0)
  const divisor = Math.max(0, Number(rule.dice_count_level_divisor) || 0)
  const scaled = divisor
    ? (rule.dice_count_rounding === 'down' ? Math.floor(level / divisor) : Math.ceil(level / divisor))
    : fixed
  const rawDie = String(rule.dice || '').trim()
  const sides = Number(rawDie.replace(/^d/i, '')) || null
  const die = rawDie.replace(/^d/i, 'к')
  return scaled > 0 && die
    ? { value: `${scaled}${die}`, dice: sides ? { count: scaled, sides, label: rawDie } : null }
    : { value: '', dice: null }
}

function widgetValue(definition, data, level) {
  if (definition.value_source === 'weapon_damage') return featureDice(data, level)
  if (definition.value_source === 'scaling') return { value: String(currentScaling(data, level)?.value || ''), dice: null }
  return { value: String(definition.value || ''), dice: null }
}

export function collectCharacterFeatureWidgets(values, itemsById, resources = []) {
  const parts = VALUE_IDS.flatMap(valueId => (Array.isArray(values?.[valueId]) ? values[valueId] : []).flatMap(entry => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item) return []
    const level = abilityOwnerLevel(item.data || {}, values)
    const definitions = Array.isArray(item.data?.sheet_widgets) ? item.data.sheet_widgets : []
    return definitions.flatMap((definition, index) => {
      if (level < Math.max(1, Number(definition?.level) || 1)) return []
      const key = String(definition.key || `${valueId}:${entryKey(entry)}:${index}`)
      const resolvedResource = resources.find(row => (
        row.source?.valueId === valueId
        && row.source?.entryKey === entryKey(entry)
        && (!definition.resource_key || row.source?.resourceKey === definition.resource_key)
      )) || null
      const scaling = currentScaling(item.data || {}, level)
      const metric = widgetValue(definition, item.data || {}, level)
      const resource = resolvedResource || (definition.kind === 'toggle' && Number(scaling?.uses) === 0
        ? { value: '∞', total: '∞', unlimited: true }
        : null)
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
        dice: metric.dice,
        active_label: definition.active_label || 'Активно',
        inactive_label: definition.inactive_label || 'Активировать',
        priority: Number(definition.priority) || 0,
        value_id: valueId,
        entry_key: entryKey(entry),
        state_key: key,
        active: !!entry.widget_states?.[key],
        resource,
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
