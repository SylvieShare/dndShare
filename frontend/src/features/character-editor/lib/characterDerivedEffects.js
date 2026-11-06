import { ownedFeatureRules } from './ownedFeatureRules'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'
import { selectedTargetRollRules } from './selectedTarget'
import { transferArmorEffects } from './weaponBonusTransfer'
import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'


function asArray(value) { return Array.isArray(value) ? value : [] }
function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function selected(entry, key) {
  return key && Array.isArray(entry?.choices?.[key]) ? entry.choices[key] : []
}

function intersects(left, right) {
  const wanted = new Set(asArray(right).map(String))
  return asArray(left).some(value => wanted.has(String(value)))
}

function choiceMatches(rule, entry) {
  if (!rule?.choice_key) return true
  const values = selected(entry, rule.choice_key)
  const allowed = asArray(rule.choice_values)
  return values.length > 0 && (!allowed.length || intersects(values, allowed))
}

function targetMatches(rule, entry, context) {
  if (rule.weapon_uid && rule.weapon_uid !== context.targetId) return false
  if (rule.excluded_weapon_uid && rule.excluded_weapon_uid === context.targetId) return false
  const targetIds = asArray(rule?.target_ids)
  if (!rule?.target_from_choice && targetIds.length) {
    return context.targetId != null && targetIds.some(value => String(value) === String(context.targetId))
  }
  if (!rule?.target_from_choice) return true
  const target = context.skillId ?? context.abilitySuggestId ?? context.targetId
  const prefix = rule.choice_value_prefix ? `${rule.choice_value_prefix}:` : ''
  return target != null && selected(entry, rule.choice_key).some(value => String(value) === `${prefix}${target}`)
}

function contextMatches(rule, entry, context = {}) {
  if (rule.weapon_attacks_only && !context.weaponAttack) return false
  if (rule.forbid_improvised && context.improvisedWeapon) return false
  if (!choiceMatches(rule, entry) || !targetMatches(rule, entry, context)) return false
  const scopes = asArray(rule.scopes)
  if (scopes.length && !scopes.includes(context.kind)) return false
  const abilities = asArray(rule.ability_ids)
  if (abilities.length && !['armor_formula', 'ability_minimum'].includes(rule.kind) && !abilities.some(value => String(value) === String(context.abilitySuggestId))) return false
  const skills = asArray(rule.skill_ids)
  if (skills.length && !skills.some(value => String(value) === String(context.skillId))) return false
  if (rule.weapon_kind === 'ranged' && context.weaponKind !== 'ranged') return false
  if (rule.weapon_kind === 'melee' && context.weaponKind !== 'melee') return false
  if (!context.deferEquipment) {
    const gear = rule.equippedArmor || context
    if (rule.requires_armor && !gear.bodyArmor) return false
    if (rule.requires_no_armor && gear.bodyArmor) return false
    if (rule.forbid_heavy_armor && gear.heavyArmor) return false
    if (rule.allow_shield === false && gear.shield) return false
  }
  if (rule.only_without_proficiency && context.proficient) return false
  return true
}

export function collectCharacterDerivedEffects(values = {}, itemsById = new Map()) {
  const ownedEffects = []
  for (const { rule, valueId, entry, item, index, ownerLevel } of ownedFeatureRules(values, itemsById, 'derived_effects')) {
    if (!rule.kind) continue
    ownedEffects.push({
      ...rule,
      key: `${valueId}:${entry.uid || entry.id}:derived:${index}`,
      ownerLevel,
      source_label: item.name || 'Способность',
      source_entry: entry,
      weapon_uid: item.data?.weapon && ['weapon_attack_bonus', 'weapon_damage_bonus', 'critical_threshold'].includes(rule.kind) ? entry.uid : null,
    })
  }
  const effects = [...ownedEffects, ...transferArmorEffects(values, itemsById), ...selectedTargetRollRules(values, itemsById), ...collectStatusDerivedEffects(values, itemsById)]
  let equipment
  return effects.map(rule => {
    if (!['weapon_attack_bonus', 'weapon_damage_bonus', 'roll_mode'].includes(rule.kind) ||
        !(rule.requires_armor || rule.requires_no_armor || rule.forbid_heavy_armor || rule.allow_shield === false)) return rule
    equipment ??= speedRuleContext(deriveEquippedArmor(values, itemsById))
    return { ...rule, equippedArmor: equipment }
  })
}

export function matchingDerivedEffects(effects, kind, context = {}) {
  return asArray(effects).filter(rule => rule.kind === kind && contextMatches(rule, rule.source_entry, context))
}

export function derivedArmorRules(effects) {
  // Equipment is resolved by deriveEquippedArmor after collecting these rules.
  const context = { deferEquipment: true }
  return {
    formulas: matchingDerivedEffects(effects, 'armor_formula', context),
    bonuses: matchingDerivedEffects(effects, 'armor_bonus', context),
    minimums: matchingDerivedEffects(effects, 'armor_minimum', context),
  }
}

export function derivedSpeedBonuses(effects, context = {}) {
  const active = matchingDerivedEffects(effects, 'speed_bonus', context)
  const grouped = new Map()
  let total = 0
  for (const rule of active) {
    const value = number(rule.value)
    if (!rule.group) total += value
    else grouped.set(rule.group, Math.max(grouped.get(rule.group) || 0, value))
  }
  return {
    total: total + [...grouped.values()].reduce((sum, value) => sum + value, 0),
    multiplier: matchingDerivedEffects(effects, 'speed_multiplier', context).reduce((v, rule) => Math.max(v, Number(rule.value) || 1), 1),
    sources: active,
  }
}

export function speedRuleContext(armor = {}) {
  return { kind: 'speed', bodyArmor: !!armor.body, heavyArmor: armor.body?.item?.data?.category === 'heavy', shield: !!armor.shield }
}

export function totalSpeed(speed, bonuses, armorPenalty = 0) {
  return Math.max(0, number(speed?.base) + sumBonuses(speed?.bonuses) + bonuses.total - armorPenalty) * (bonuses.multiplier || 1)
}

export function derivedProficiency(effects, kind, context = {}) {
  const active = matchingDerivedEffects(effects, kind, context)
  return {
    rank: active.reduce((rank, rule) => Math.max(rank, number(rule.rank, 1)), 0),
    sources: active,
  }
}

export function derivedGrantedProficiencies(effects, kind) {
  return asArray(effects).filter((rule) => rule.kind === kind).flatMap((rule) => {
    const prefix = rule.choice_value_prefix ? `${rule.choice_value_prefix}:` : ''
    const targets = rule.target_from_choice
      ? selected(rule.source_entry, rule.choice_key)
        .filter((value) => !prefix || String(value).startsWith(prefix))
        .map((value) => String(value).slice(prefix.length))
      : asArray(rule.target_ids)
    return targets.filter(targetId => contextMatches(rule, rule.source_entry, { targetId }))
      .map(targetId => ({ targetId, source: rule.source_label }))
  })
}

export function derivedNumericBonus(effects, kind, values, context = {}) {
  const active = matchingDerivedEffects(effects, kind, context)
  const contributions = active.map(rule => ({ source: rule.source_label || rule.label || 'Эффект', value: numericEffectValue(rule, values) }))
  const total = contributions.reduce((sum, part) => sum + part.value, 0)
  return { total, sources: active, contributions }
}

function numericEffectValue(rule, values) {
  let value = number(rule.value)
  const stat = SUGGEST16_TO_STAT[number(rule.ability_modifier)]
  if (stat) value += abilityModifier(resolveNumValue(values?.[stat]?.value))
  if (rule.proficiency_multiplier != null) {
    const stored = values?.prof_bonus || {}
    const mastery = stored?.auto === false ? number(stored.v) : proficiencyBonus(values?.lvl?.level)
    value += Math.floor((mastery + sumBonuses(stored?.bonuses)) * number(rule.proficiency_multiplier))
  }
  if (rule.minimum != null) value = Math.max(number(rule.minimum), value)
  return value
}

export function derivedRollEffects(effects, context = {}) {
  return matchingDerivedEffects(effects, 'roll_mode', context).map(rule => ({
    mode: rule.mode,
    source: `${rule.source_label}: ${rule.label || (rule.mode === 'advantage' ? 'преимущество' : 'помеха')}`,
  }))
}

export function derivedActivityBlocks(effects, activity) {
  return matchingDerivedEffects(effects, 'activity_block', { kind: activity }).map(rule => ({
    key: rule.key,
    source: rule.source_label || '',
    label: rule.label || '',
  }))
}

export function derivedCriticalThreshold(effects, context = {}) {
  return matchingDerivedEffects(effects, 'critical_threshold', context)
    .reduce((threshold, rule) => Math.min(threshold, Math.max(2, number(rule.value, 20))), 20)
}
