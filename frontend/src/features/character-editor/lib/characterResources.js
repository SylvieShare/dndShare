import { abilityUseTotal } from '@/shared/lib/dndAbilityUses'

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

function restoresOn(resource, kind) {
  return kind === 'long'
    ? !!(resource.short_rest || resource.long_rest)
    : !!resource.short_rest
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
        const item = itemsById.get(String(entry.id))
        if (!item) return []
        const total = abilityUseTotal(item.data, values, entry)
        if (total == null || total <= 0) return []
        return [{
          key: `abilities:${valueId}:${entryKey(entry)}`,
          title: item.name || 'Способность',
          color_point: item.data?.resource_color || color,
          value: Math.min(nonNegativeInt(entry.count ?? total), total),
          total,
          short_rest: !!item.data?.rollback_short_rest,
          long_rest: !!item.data?.rollback_long_rest,
          readonly: true,
          source_label: 'Настраивается в способности',
          source: { sourceId: this.id, valueId, entryKey: entryKey(entry) },
        }]
      })
    },
    setAvailable(values, resource, available) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      const key = resource.source?.entryKey
      if (!entries.some((entry) => entryKey(entry) === key)) return {}
      const nextValue = Math.min(nonNegativeInt(available), nonNegativeInt(resource.total))
      return {
        [valueId]: entries.map((entry) => entryKey(entry) === key ? { ...entry, count: nextValue } : entry),
      }
    },
    restore(values, itemsById, kind) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      const recoveredNames = []
      let changed = false
      const next = entries.map((entry) => {
        const item = itemsById.get(String(entry.id))
        if (!item) return entry
        const total = abilityUseTotal(item.data, values, entry)
        const resource = {
          short_rest: !!item.data?.rollback_short_rest,
          long_rest: !!item.data?.rollback_long_rest,
        }
        if (total == null || !restoresOn(resource, kind)) return entry
        const current = entry.count == null ? total : nonNegativeInt(entry.count)
        if (current < total) recoveredNames.push(item.name || 'Способность')
        if (current === total) return entry
        changed = true
        return { ...entry, count: total }
      })
      return { patch: changed ? { [valueId]: next } : {}, recoveredNames }
    },
  }
}

export const DND_CHARACTER_RESOURCE_SOURCES = [
  createManualResourceSource('resources'),
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
