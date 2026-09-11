import { weaponDamageDiceCount } from '@/shared/lib/abilityProgression'
import { FEATURE_VALUE_IDS, featureEntries } from './characterMagicItems'
import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { featureEntryActive } from './featureEntryState'

const VALUE_IDS = FEATURE_VALUE_IDS

function abilityRows(values, itemsById, field) {
  return VALUE_IDS.flatMap((valueId) => featureEntries(values, valueId, itemsById).flatMap((entry) => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item) return []
    const ownerLevel = abilityOwnerLevel(item.data || {}, values)
    return (Array.isArray(item.data?.[field]) ? item.data[field] : []).flatMap((rule, index) => {
      if (ownerLevel < Math.max(1, Number(rule?.level) || 1)) return []
      return [{
        ...rule,
        key: `${valueId}:${entry.uid || entry.id}:${field}:${field === 'weapon_damage' ? rule.key : index}`,
        requires_damage_key: field === 'weapon_damage' && rule.requires_damage_key
          ? `${valueId}:${entry.uid || entry.id}:${field}:${rule.requires_damage_key}` : null,
        owner_level: ownerLevel,
        resource_owner: { valueId, entryKey: String(entry.uid || entry.id) },
        weapon_uid: item.data?.weapon && ['weapon_damage', 'critical_damage'].includes(field) ? entry.uid : null,
        source_label: item.name || 'Способность',
      }]
    })
  }))
}

export function collectCharacterCombatEffects(values, itemsById) {
  return {
    rollTriggers: abilityRows(values, itemsById, 'roll_triggers'),
    rollAdjustments: abilityRows(values, itemsById, 'roll_adjustments'),
    criticalDamage: abilityRows(values, itemsById, 'critical_damage'),
    weaponDamage: abilityRows(values, itemsById, 'weapon_damage'),
  }
}

export function matchingRollTriggers(effects, scope) {
  return (effects?.rollTriggers || []).filter((rule) => {
    const scopes = Array.isArray(rule.scopes) ? rule.scopes : []
    return !scopes.length || scopes.includes(scope)
  })
}

export function matchingRollAdjustments(effects, scope, context = {}) {
  const proficiencyRank = Math.max(0, Number(context.proficiencyRank) || 0)
  return (effects?.rollAdjustments || []).filter((rule) => {
    const scopes = Array.isArray(rule.scopes) ? rule.scopes : []
    if (rule.scope && rule.scope !== scope) return false
    if (scopes.length && !scopes.includes(scope)) return false
    return proficiencyRank >= Math.max(0, Number(rule.minimum_proficiency_rank) || 0)
  })
}

export function extraCriticalWeaponDice(effects, { melee = false, weaponUid } = {}) {
  return (effects?.criticalDamage || []).reduce((sum, rule) => {
    if (rule.weapon_uid && rule.weapon_uid !== weaponUid) return sum
    if (rule.weapon_kind === 'melee' && !melee) return sum
    return sum + Math.max(0, Number(rule.extra_weapon_dice) || 0)
  }, 0)
}

function weaponKindMatches(rule, context) {
  if (rule.weapon_kind === 'melee') return !!context.melee
  if (rule.weapon_kind === 'ranged') return !!context.ranged
  if (rule.weapon_kind === 'finesse') return !!context.finesse
  if (rule.weapon_kind === 'finesse_or_ranged') return !!context.finesse || !!context.ranged
  return true
}

export function matchingWeaponDamageActions(effects, context = {}) {
  return (effects?.weaponDamage || [])
    .filter(rule => (!rule.weapon_uid || rule.weapon_uid === context.weaponUid) && weaponKindMatches(rule, context))
    .map(rule => ({ ...rule, dice_count: weaponDamageDiceCount(rule, rule.owner_level) }))
    .filter(rule => rule.dice_count > 0 && String(rule.dice || '').trim())
}
