import { abilityOwnerLevel, abilityUseTotal } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

const ABILITY_RESOURCE_COLORS = [
  '#f87171', '#fbbf24', '#4ade80', '#38bdf8', '#c084fc', '#94a3b8',
  '#fb7185', '#fb923c', '#2dd4bf', '#60a5fa', '#818cf8', '#e879f9',
]

function abilityResourceColor(item, definition, fallback) {
  const configured = definition.rule.resource_color || item.data?.resource_color
  if (configured) return configured
  const seed = `${item.id ?? item.name ?? ''}:${definition.key || 'main'}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0
  return ABILITY_RESOURCE_COLORS[hash % ABILITY_RESOURCE_COLORS.length] || fallback
}

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

function restoresOn(resource, kind) {
  return kind === 'long'
    ? !!(resource.short_rest || resource.long_rest)
    : !!resource.short_rest
}

function abilityResourceDefinitions(itemData) {
  const rules = Array.isArray(itemData?.use_resources) ? itemData.use_resources.filter(Boolean) : []
  if (!rules.length) return [{ key: null, rule: itemData || {}, multiple: false }]
  return rules.map((rule, index) => ({
    key: String(rule.key || `resource_${index + 1}`),
    rule,
    multiple: true,
  }))
}

function abilityRestRule(rule, ownerData, values) {
  const level = abilityOwnerLevel(ownerData, values)
  const shortRestLevel = rule.rollback_short_rest_level == null ? null : nonNegativeInt(rule.rollback_short_rest_level)
  const partialLevel = rule.short_rest_recovery_level == null ? null : nonNegativeInt(rule.short_rest_recovery_level)
  return {
    short_rest: !!rule.rollback_short_rest || (shortRestLevel != null && level >= shortRestLevel),
    long_rest: !!rule.rollback_long_rest,
    short_rest_recovery: partialLevel == null || level >= partialLevel
      ? nonNegativeInt(rule.short_rest_recovery)
      : 0,
  }
}

function abilityAvailable(entry, definition, total) {
  if (!definition.multiple) return entry.count == null ? total : nonNegativeInt(entry.count)
  const stored = entry.resource_counts?.[definition.key]
  return stored == null ? total : nonNegativeInt(stored)
}

function withAbilityAvailable(entry, definition, available) {
  if (!definition.multiple) return { ...entry, count: available, resource_version: 1 }
  return {
    ...entry,
    resource_version: 1,
    resource_counts: { ...(entry.resource_counts || {}), [definition.key]: available },
  }
}

function restoredAvailable(resource, kind, current, total) {
  if (kind === 'long') return restoresOn(resource, kind) ? total : current
  if (resource.short_rest) return total
  return Math.min(total, current + nonNegativeInt(resource.short_rest_recovery))
}

function classResourceTotal(rule, classLevel) {
  const unlockLevel = Math.max(1, nonNegativeInt(rule?.level) || 1)
  if (classLevel < unlockLevel) return null
  const rows = (Array.isArray(rule?.scaling) ? rule.scaling : [])
    .filter((row) => row?.uses != null && nonNegativeInt(row.level) <= classLevel)
    .sort((left, right) => nonNegativeInt(right.level) - nonNegativeInt(left.level))
  if (rows.length) return nonNegativeInt(rows[0].uses)
  if (rule?.max_use == null || rule.max_use === '') return null
  return nonNegativeInt(rule.max_use)
}

/**
 * A resource source implements this small contract:
 * - itemIds(values): handbook ids it needs hydrated;
 * - collect(values, itemsById): normalized resource rows;
 * - setAvailable(values, resource, available): character-values patch;
 * - restore(values, itemsById, kind): character-values patch + recovered names.
 *
 * New domains (for example magic items) can contribute to the same resource
 * block by adding another source without coupling that block or the rest UI to
 * the domain's storage shape.
 */
export function createManualResourceSource(valueId = 'resources') {
  return {
    id: `manual:${valueId}`,
    itemIds: () => [],
    collect(values) {
      const rows = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return rows.map((row, index) => ({
        ...row,
        key: `manual:${valueId}:${index}`,
        value: Math.min(nonNegativeInt(row.value), nonNegativeInt(row.total)),
        total: nonNegativeInt(row.total),
        readonly: false,
        source: { sourceId: this.id, valueId, entryKey: String(index) },
      }))
    },
    setAvailable(values, resource, available) {
      const index = Number(resource.source?.entryKey)
      const rows = Array.isArray(values?.[valueId]) ? values[valueId] : []
      if (!Number.isInteger(index) || !rows[index]) return {}
      return {
        [valueId]: rows.map((row, rowIndex) => rowIndex === index
          ? { ...row, value: Math.min(nonNegativeInt(available), nonNegativeInt(row.total)) }
          : row),
      }
    },
    restore(values, _itemsById, kind) {
      const rows = Array.isArray(values?.[valueId]) ? values[valueId] : []
      const recoveredNames = []
      let changed = false
      const next = rows.map((row) => {
        if (!restoresOn(row, kind)) return row
        const total = nonNegativeInt(row.total)
        if (nonNegativeInt(row.value) < total) recoveredNames.push(row.title || 'Ресурс')
        if (Number(row.value) === total) return row
        changed = true
        return { ...row, value: total }
      })
      return { patch: changed ? { [valueId]: next } : {}, recoveredNames }
    },
  }
}

export function createAbilityResourceSource(valueId, color) {
  return {
    id: `abilities:${valueId}`,
    itemIds(values) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return entries.map((entry) => entry?.id).filter((id) => id != null)
    },
    collect(values, itemsById) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return entries.flatMap((entry) => {
        if (!featureEntryActive(valueId, entry)) return []
        const item = itemsById.get(String(entry.id))
        if (!item) return []
        return abilityResourceDefinitions(item.data).flatMap((definition) => {
          const total = abilityUseTotal(definition.rule, values, entry, item.data)
          if (total == null || total <= 0) return []
          const rest = abilityRestRule(definition.rule, item.data, values)
          return [{
            key: `abilities:${valueId}:${entryKey(entry)}${definition.key ? `:${definition.key}` : ''}`,
            item_id: item.id,
            title: definition.rule.title || item.name || 'Способность',
            color_point: abilityResourceColor(item, definition, color),
            value: Math.min(abilityAvailable(entry, definition, total), total),
            total,
            ...rest,
            readonly: true,
            source_label: 'способности',
            source: {
              sourceId: this.id,
              valueId,
              entryKey: entryKey(entry),
              resourceKey: definition.key,
              multiple: definition.multiple,
            },
          }]
        })
      })
    },
    setAvailable(values, resource, available) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      const key = resource.source?.entryKey
      if (!entries.some((entry) => entryKey(entry) === key)) return {}
      const nextValue = Math.min(nonNegativeInt(available), nonNegativeInt(resource.total))
      const definition = {
        key: resource.source?.resourceKey,
        multiple: !!resource.source?.multiple,
      }
      return {
        [valueId]: entries.map((entry) => entryKey(entry) === key
          ? withAbilityAvailable(entry, definition, nextValue)
          : entry),
      }
    },
    restore(values, itemsById, kind) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      const recoveredNames = []
      let changed = false
      const next = entries.map((entry) => {
        if (!featureEntryActive(valueId, entry)) return entry
        const item = itemsById.get(String(entry.id))
        if (!item) return entry
        let nextEntry = entry
        for (const definition of abilityResourceDefinitions(item.data)) {
          const total = abilityUseTotal(definition.rule, values, nextEntry, item.data)
          if (total == null) continue
          const resource = abilityRestRule(definition.rule, item.data, values)
          const current = Math.min(abilityAvailable(nextEntry, definition, total), total)
          const restored = restoredAvailable(resource, kind, current, total)
          if (restored <= current) continue
          recoveredNames.push(definition.rule.title || item.name || 'Способность')
          nextEntry = withAbilityAvailable(nextEntry, definition, restored)
          changed = true
        }
        return nextEntry
      })
      return { patch: changed ? { [valueId]: next } : {}, recoveredNames }
    },
  }
}

/**
 * Resources granted by class levels live outside individual ability entries.
 * Rules with the same key are one shared pool, so multiclass combinations can
 * add more ways to spend it without creating extra charges.
 */
export function createClassResourceSource(valueId = 'class_resource_counts', color = '#fbbf24') {
  return {
    id: 'classes',
    itemIds(values) {
      return (Array.isArray(values?.classes) ? values.classes : [])
        .map((entry) => entry?.id)
        .filter((id) => id != null)
    },
    collect(values, itemsById) {
      const groups = new Map()
      for (const classEntry of (Array.isArray(values?.classes) ? values.classes : [])) {
        const item = itemsById.get(String(classEntry?.id))
        if (!item) continue
        const classLevel = nonNegativeInt(classEntry?.level)
        for (const rule of (Array.isArray(item.data?.class_resources) ? item.data.class_resources : [])) {
          const key = String(rule?.key || '').trim()
          const total = classResourceTotal(rule, classLevel)
          if (!key || total == null || total <= 0) continue
          const rest = abilityRestRule(rule, rule, { lvl: { level: classLevel } })
          const current = groups.get(key)
          groups.set(key, {
            key: `classes:${key}`,
            pool_key: key,
            title: String(rule.title || current?.title || item.name || 'Ресурс класса'),
            color_point: rule.resource_color || current?.color_point || color,
            total: Math.max(total, current?.total || 0),
            short_rest: !!(current?.short_rest || rest.short_rest),
            long_rest: !!(current?.long_rest || rest.long_rest),
            short_rest_recovery: Math.max(current?.short_rest_recovery || 0, rest.short_rest_recovery),
            readonly: true,
            source_label: 'класса',
            source: {
              sourceId: this.id,
              valueId,
              entryKey: key,
              resourceKey: key,
              poolKey: key,
            },
          })
        }
      }
      const stored = values?.[valueId] && typeof values[valueId] === 'object' && !Array.isArray(values[valueId])
        ? values[valueId]
        : {}
      return [...groups.values()].map((resource) => ({
        ...resource,
        value: stored[resource.pool_key] == null
          ? resource.total
          : Math.min(nonNegativeInt(stored[resource.pool_key]), resource.total),
      }))
    },
    setAvailable(values, resource, available) {
      const key = String(resource.source?.entryKey || '')
      if (!key) return {}
      const stored = values?.[valueId] && typeof values[valueId] === 'object' && !Array.isArray(values[valueId])
        ? values[valueId]
        : {}
      return {
        [valueId]: {
          ...stored,
          [key]: Math.min(nonNegativeInt(available), nonNegativeInt(resource.total)),
        },
      }
    },
    restore(values, itemsById, kind) {
      const resources = this.collect(values, itemsById)
      const stored = values?.[valueId] && typeof values[valueId] === 'object' && !Array.isArray(values[valueId])
        ? values[valueId]
        : {}
      const next = { ...stored }
      const recoveredNames = []
      let changed = false
      for (const resource of resources) {
        if (!restoresOn(resource, kind) || resource.value >= resource.total) continue
        next[resource.pool_key] = resource.total
        recoveredNames.push(resource.title)
        changed = true
      }
      return { patch: changed ? { [valueId]: next } : {}, recoveredNames }
    },
  }
}

export const DND_CHARACTER_RESOURCE_SOURCES = [
  createManualResourceSource('resources'),
  createClassResourceSource(),
  createAbilityResourceSource('abilities_feats', '#c084fc'),
  createAbilityResourceSource('abilities_race', '#5aaf72'),
  createAbilityResourceSource('abilities_class', '#4f8fcc'),
]

export function resourceItemIds(values, sources = DND_CHARACTER_RESOURCE_SOURCES) {
  return [...new Set(sources.flatMap((source) => source.itemIds(values)).map(String))]
}

export function collectCharacterResources(values, itemsById, sources = DND_CHARACTER_RESOURCE_SOURCES) {
  return sources.flatMap((source) => source.collect(values, itemsById))
}

export function setCharacterResourceAvailable(values, itemsById, resourceKey, available, sources = DND_CHARACTER_RESOURCE_SOURCES) {
  const resource = collectCharacterResources(values, itemsById, sources).find((row) => row.key === resourceKey)
  if (!resource) return {}
  const source = sources.find((candidate) => candidate.id === resource.source?.sourceId)
  return source?.setAvailable(values, resource, available) || {}
}

export function restoreCharacterResources(values, itemsById, kind, sources = DND_CHARACTER_RESOURCE_SOURCES) {
  const patch = {}
  const recoveredNames = []
  for (const source of sources) {
    const result = source.restore(values, itemsById, kind)
    Object.assign(patch, result.patch)
    recoveredNames.push(...result.recoveredNames)
  }
  return { patch, recoveredNames }
}
