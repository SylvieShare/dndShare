import { MAGIC_VALUE_ID } from './characterMagicItems'
import { ownedFeatureRules } from './ownedFeatureRules'

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

export function createAbilityPassiveEffectSource(valueId) {
  return {
    id: `abilities:${valueId}`,
    collect(values, itemsById) {
      return [...ownedFeatureRules(values, itemsById, 'passive_effects', [valueId])].flatMap(({ rule, entry, item, index }) => {
        if (!rule.title) return []
        return [{
          key: `${this.id}:${entryKey(entry)}:${index}`,
          title: rule.title,
          description: rule.description || '',
          tone: rule.tone || 'info',
          source_label: item.name || 'Способность',
          source: { sourceId: this.id, valueId, itemId: item.id, entryKey: entryKey(entry) },
        }]
      })
    },
  }
}

export const DND_CHARACTER_PASSIVE_EFFECT_SOURCES = [
  createAbilityPassiveEffectSource(MAGIC_VALUE_ID),
  createAbilityPassiveEffectSource('abilities_feats'),
  createAbilityPassiveEffectSource('abilities_race'),
  createAbilityPassiveEffectSource('abilities_class'),
  createAbilityPassiveEffectSource('abilities_story'),
]

export function collectCharacterPassiveEffects(values, itemsById, sources = DND_CHARACTER_PASSIVE_EFFECT_SOURCES) {
  return sources.flatMap((source) => source.collect(values, itemsById))
}
