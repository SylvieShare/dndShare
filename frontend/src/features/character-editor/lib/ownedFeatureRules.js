import { FEATURE_VALUE_IDS, featureEntries } from './characterMagicItems'
import { itemRuleActive } from './itemRuleActivation'
import { featureEntryActive } from './featureEntryState'
import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'

/** Rules belong to a sheet instance. Its choices, stock and activation never come from another copy. */
export function* ownedFeatureRules(values, itemsById, field, valueIds = FEATURE_VALUE_IDS) {
  for (const valueId of valueIds) {
    for (const entry of featureEntries(values, valueId, itemsById, true)) {
      if (!featureEntryActive(valueId, entry)) continue
      const item = itemsById.get(String(entry.id))
      const rows = item?.data?.[field]
      if (!Array.isArray(rows) || !rows.length) continue
      const ownerLevel = abilityOwnerLevel(item.data, values)
      for (const [index, rule] of rows.entries()) {
        if (!rule || ownerLevel < Math.max(1, Number(rule.level) || 1)) continue
        if (itemRuleActive(values, item, entry, rule)) yield { valueId, entry, item, rule, index, ownerLevel }
      }
    }
  }
}
