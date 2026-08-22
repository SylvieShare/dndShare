import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

const VALUE_IDS = ['abilities_feats', 'abilities_race', 'abilities_class']

function abilityRows(values, itemsById, field) {
  return VALUE_IDS.flatMap((valueId) => (Array.isArray(values?.[valueId]) ? values[valueId] : []).flatMap((entry) => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item) return []
    const ownerLevel = abilityOwnerLevel(item.data || {}, values)
    return (Array.isArray(item.data?.[field]) ? item.data[field] : []).flatMap((rule, index) => {
      if (ownerLevel < Math.max(1, Number(rule?.level) || 1)) return []
      return [{ ...rule, key: `${valueId}:${entry.uid || entry.id}:${field}:${index}`, source_label: item.name || 'Способность' }]
    })
  }))
}

export function collectCharacterCombatEffects(values, itemsById) {
  return {
    rollTriggers: abilityRows(values, itemsById, 'roll_triggers'),
    criticalDamage: abilityRows(values, itemsById, 'critical_damage'),
  }
}

export function matchingRollTriggers(effects, scope) {
  return (effects?.rollTriggers || []).filter((rule) => {
    const scopes = Array.isArray(rule.scopes) ? rule.scopes : []
    return !scopes.length || scopes.includes(scope)
  })
}

export function extraCriticalWeaponDice(effects, { melee = false } = {}) {
  return (effects?.criticalDamage || []).reduce((sum, rule) => {
    if (rule.weapon_kind === 'melee' && !melee) return sum
    return sum + Math.max(0, Number(rule.extra_weapon_dice) || 0)
  }, 0)
}
