import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'
import { collectStatusDefenses } from './characterStatuses'

export const DEFENSE_KINDS = Object.freeze([
  { value: 'resistance', label: 'Сопротивление' },
  { value: 'immunity', label: 'Невосприимчивость' },
  { value: 'vulnerability', label: 'Уязвимость' },
])

const DEFENSE_KIND_VALUES = new Set(DEFENSE_KINDS.map((entry) => entry.value))

function normalizedDamageType(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

function normalizedKind(value) {
  return DEFENSE_KIND_VALUES.has(value) ? value : 'resistance'
}

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

/**
 * A defense source exposes the handbook ids it needs and produces normalized
 * rows. Sources own their storage; the shared block only presents the result.
 */
export function createManualDefenseSource(valueId = 'defenses') {
  return {
    id: `manual:${valueId}`,
    itemIds: () => [],
    collect(values) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return entries.flatMap((entry, index) => {
        const damageType = normalizedDamageType(entry?.damage_type)
        if (damageType == null) return []
        return [{
          ...entry,
          key: `manual:${valueId}:${index}`,
          damage_type: damageType,
          kind: normalizedKind(entry?.kind),
          readonly: false,
          source: { sourceId: this.id, valueId, entryKey: String(index) },
        }]
      })
    },
  }
}

export function createAbilityDefenseSource(valueId) {
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
        const ownerLevel = abilityOwnerLevel(item.data || {}, values)
        const fixed = (Array.isArray(item.data?.defenses) ? item.data.defenses : []).flatMap((rule, index) => {
          const damageType = normalizedDamageType(rule?.damage_type)
          const unlockLevel = Number(rule?.level) || 1
          if (damageType == null || ownerLevel < unlockLevel) return []
          return [{
            key: `abilities:${valueId}:${entryKey(entry)}:${index}`,
            damage_type: damageType,
            kind: normalizedKind(rule?.kind),
            readonly: true,
            source_label: `способность «${item.name || 'Без названия'}»`,
            source: {
              sourceId: this.id,
              valueId,
              entryKey: entryKey(entry),
              itemId: item.id,
            },
          }]
        })
        const selected = (Array.isArray(item.data?.choice_defenses) ? item.data.choice_defenses : []).flatMap((rule, index) => {
          const sourceEntry = entries.find((candidate) => String(candidate?.id) === String(rule?.source_item_id))
          const choices = Array.isArray(sourceEntry?.choices?.[rule?.choice_key]) ? sourceEntry.choices[rule.choice_key] : []
          return choices.flatMap((choice) => (Array.isArray(rule?.options) ? rule.options : []).flatMap((option) => {
            const damageType = normalizedDamageType(option?.damage_type)
            if (String(option?.value) !== String(choice) || damageType == null) return []
            return [{
              key: `abilities:${valueId}:${entryKey(entry)}:choice:${index}:${choice}`,
              damage_type: damageType,
              kind: normalizedKind(option?.kind),
              readonly: true,
              source_label: `способность «${item.name || 'Без названия'}»`,
              source: { sourceId: this.id, valueId, entryKey: entryKey(entry), itemId: item.id },
            }]
          }))
        })
        return [...fixed, ...selected]
      })
    },
  }
}

export const DND_CHARACTER_DEFENSE_SOURCES = [
  createManualDefenseSource('defenses'),
  createAbilityDefenseSource('abilities_feats'),
  createAbilityDefenseSource('abilities_race'),
  createAbilityDefenseSource('abilities_class'),
]

export function defenseItemIds(values, sources = DND_CHARACTER_DEFENSE_SOURCES) {
  return [...new Set(sources.flatMap((source) => source.itemIds(values)).map(String))]
}

export function collectCharacterDefenses(values, itemsById, sources = DND_CHARACTER_DEFENSE_SOURCES) {
  return [
    ...sources.flatMap((source) => source.collect(values, itemsById)),
    ...collectStatusDefenses(values, itemsById),
  ]
}
