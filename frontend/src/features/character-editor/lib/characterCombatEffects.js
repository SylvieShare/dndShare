import { ownedFeatureRules } from './ownedFeatureRules'
import { collectCharacterStatuses } from './characterStatuses'
import { selectedTargetDamageRules } from './selectedTarget'
import { weaponDamageDiceCount } from '@/shared/lib/abilityProgression'

function abilityRows(values, itemsById, field) {
  return Array.from(ownedFeatureRules(values, itemsById, field), ({ rule, entry, item, index, ownerLevel, valueId }) => ({
    ...rule,
    key: `${valueId}:${entry.uid || entry.id}:${field}:${field === 'weapon_damage' ? rule.key : index}`,
    requires_damage_key: field === 'weapon_damage' && rule.requires_damage_key
      ? `${valueId}:${entry.uid || entry.id}:${field}:${rule.requires_damage_key}` : null,
    owner_level: ownerLevel,
    resource_owner: { valueId, entryKey: String(entry.uid || entry.id) },
    weapon_uid: item.data?.weapon && ['weapon_damage', 'critical_damage'].includes(field) ? entry.uid : null,
    source_label: item.name || 'Способность',
  }))
}

function statusWeaponDamage(values, itemsById) {
  return collectCharacterStatuses(values, itemsById)
    .filter(status => !status.external_only && (!status.item.data?.weapon_target || status.params?.weapon_uid))
    .flatMap(status => (status.item.data?.weapon_damage || []).map((rule, i) => ({
      ...rule,
      ...(rule.dice_count_parameter ? { dice_count: Number(status.params?.[rule.dice_count_parameter]) || 0 } : {}),
      key: `status:${status.uid}:damage:${i}`,
      source_label: status.title,
      owner_level: 1,
      weapon_uid: status.params?.weapon_uid,
    })))
}

export function collectCharacterCombatEffects(values, itemsById) {
  return {
    rollTriggers: abilityRows(values, itemsById, 'roll_triggers'),
    rollAdjustments: abilityRows(values, itemsById, 'roll_adjustments'),
    criticalDamage: abilityRows(values, itemsById, 'critical_damage'),
    weaponDamage: [...abilityRows(values, itemsById, 'weapon_damage'), ...selectedTargetDamageRules(values, itemsById),
      ...statusWeaponDamage(values, itemsById)],
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

export function criticalWeaponDiceRules(effects, { melee = false, weaponUid } = {}) {
  return (effects?.criticalDamage || []).filter(rule =>
    (!rule.weapon_uid || rule.weapon_uid === weaponUid) &&
    (rule.weapon_kind !== 'melee' || melee) && Number(rule.extra_weapon_dice) > 0)
}

export function extraCriticalWeaponDice(effects, context) {
  return criticalWeaponDiceRules(effects, context).reduce((sum, rule) => sum + Number(rule.extra_weapon_dice), 0)
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
    .filter(rule => rule.target_choice || (rule.dice_count > 0 && String(rule.dice || '').trim()))
}
