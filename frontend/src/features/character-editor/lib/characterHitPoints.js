import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

export function createAbilityHpBonusSource(valueId, category) {
  return {
    id: `abilities:${valueId}`,
    collect(values, itemsById) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return entries.flatMap((entry) => {
        if (!featureEntryActive(valueId, entry)) return []
        const item = itemsById.get(String(entry.id))
        if (!item) return []
        const level = abilityOwnerLevel(item.data || {}, values)
        return (Array.isArray(item.data?.hp_bonuses) ? item.data.hp_bonuses : []).flatMap((rule, index) => {
          const unlockLevel = Math.max(1, Number(rule?.level) || 1)
          if (level < unlockLevel) return []
          const value = (Number(rule?.base) || 0) + level * (Number(rule?.per_level) || 0)
          if (!value) return []
          return [{
            key: `${this.id}:${entryKey(entry)}:${index}`,
            name: rule.title || item.name || 'Способность',
            title: rule.title || item.name || 'Способность',
            value,
            readonly: true,
            source_label: `способность «${item.name || 'Без названия'}»`,
            source: { sourceId: this.id, category, itemId: item.id, entryKey: entryKey(entry) },
          }]
        })
      })
    },
  }
}

export const DND_CHARACTER_HP_BONUS_SOURCES = [
  createAbilityHpBonusSource('abilities_race', 'race'),
  createAbilityHpBonusSource('abilities_class', 'class'),
  createAbilityHpBonusSource('abilities_feats', 'feat'),
]

export function collectCharacterHpBonuses(values, itemsById, sources = DND_CHARACTER_HP_BONUS_SOURCES) {
  return sources.flatMap((source) => source.collect(values, itemsById))
}
