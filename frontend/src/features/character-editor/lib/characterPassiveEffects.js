import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

export function createAbilityPassiveEffectSource(valueId) {
  return {
    id: `abilities:${valueId}`,
    collect(values, itemsById) {
      const entries = Array.isArray(values?.[valueId]) ? values[valueId] : []
      return entries.flatMap((entry) => {
        const item = itemsById.get(String(entry.id))
        if (!item) return []
        const level = abilityOwnerLevel(item.data || {}, values)
        return (Array.isArray(item.data?.passive_effects) ? item.data.passive_effects : []).flatMap((rule, index) => {
          if (level < Math.max(1, Number(rule?.level) || 1) || !rule?.title) return []
          return [{
            key: `${this.id}:${entryKey(entry)}:${index}`,
            title: rule.title,
            description: rule.description || '',
            tone: rule.tone || 'info',
            source_label: item.name || 'Способность',
            source: { sourceId: this.id, valueId, itemId: item.id, entryKey: entryKey(entry) },
          }]
        })
      })
    },
  }
}

export const DND_CHARACTER_PASSIVE_EFFECT_SOURCES = [
  createAbilityPassiveEffectSource('abilities_feats'),
  createAbilityPassiveEffectSource('abilities_race'),
  createAbilityPassiveEffectSource('abilities_class'),
]

export function collectCharacterPassiveEffects(values, itemsById, sources = DND_CHARACTER_PASSIVE_EFFECT_SOURCES) {
  return sources.flatMap((source) => source.collect(values, itemsById))
}

