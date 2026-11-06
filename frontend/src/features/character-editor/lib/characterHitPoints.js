import { MAGIC_VALUE_ID } from './characterMagicItems'
import { ownedFeatureRules } from './ownedFeatureRules'

function entryKey(entry) {
  return String(entry?.uid || entry?.id || '')
}

export function createAbilityHpBonusSource(valueId, category) {
  return {
    id: `abilities:${valueId}`,
    collect(values, itemsById) {
      return [...ownedFeatureRules(values, itemsById, 'hp_bonuses', [valueId])].flatMap(({ rule, entry, item, index, ownerLevel }) => {
        const value = (Number(rule.base) || 0) + ownerLevel * (Number(rule.per_level) || 0)
        if (!value) return []
        return [{
          key: `${this.id}:${entryKey(entry)}:${index}`,
          name: rule.title || item.name || 'Способность',
          title: rule.title || item.name || 'Способность',
          value,
          readonly: true,
          source_label: `${valueId === MAGIC_VALUE_ID ? 'предмет' : 'способность'} «${item.name || 'Без названия'}»`,
          source: { sourceId: this.id, category, itemId: item.id, entryKey: entryKey(entry) },
        }]
      })
    },
  }
}

export const DND_CHARACTER_HP_BONUS_SOURCES = [
  createAbilityHpBonusSource(MAGIC_VALUE_ID, 'item'),
  createAbilityHpBonusSource('abilities_race', 'race'),
  createAbilityHpBonusSource('abilities_class', 'class'),
  createAbilityHpBonusSource('abilities_story', 'story'),
  createAbilityHpBonusSource('abilities_feats', 'feat'),
]

export function collectCharacterHpBonuses(values, itemsById, sources = DND_CHARACTER_HP_BONUS_SOURCES) {
  return sources.flatMap((source) => source.collect(values, itemsById))
}
