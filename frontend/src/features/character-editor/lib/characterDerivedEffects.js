import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { featureEntryActive } from '@/features/character-editor/lib/featureEntryState'
import { collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'

const VALUE_IDS = ['abilities_feats', 'abilities_race', 'abilities_class']

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
  if (!rule?.target_from_choice) return true
  const target = context.skillId ?? context.abilitySuggestId ?? context.targetId
  const prefix = rule.choice_value_prefix ? `${rule.choice_value_prefix}:` : ''
  return target != null && selected(entry, rule.choice_key).some(value => String(value) === `${prefix}${target}`)
}

function contextMatches(rule, entry, context = {}) {
  if (!choiceMatches(rule, entry) || !targetMatches(rule, entry, context)) return false
  const scopes = asArray(rule.scopes)
  if (scopes.length && !scopes.includes(context.kind)) return false
  const abilities = asArray(rule.ability_ids)
  if (abilities.length && context.abilitySuggestId != null && !abilities.some(value => String(value) === String(context.abilitySuggestId))) return false
  const skills = asArray(rule.skill_ids)
  if (skills.length && !skills.some(value => String(value) === String(context.skillId))) return false
  if (rule.weapon_kind === 'ranged' && context.weaponKind !== 'ranged') return false
  if (rule.weapon_kind === 'melee' && context.weaponKind !== 'melee') return false
  if (rule.requires_armor && !context.bodyArmor) return false
  if (rule.requires_no_armor && context.bodyArmor) return false
  if (rule.forbid_heavy_armor && context.heavyArmor) return false
  if (rule.allow_shield === false && context.shield) return false
  if (rule.only_without_proficiency && context.proficient) return false
  return true
}

export function collectCharacterDerivedEffects(values = {}, itemsById = new Map()) {
  const ownedEffects = VALUE_IDS.flatMap((valueId) => asArray(values?.[valueId]).flatMap((entry) => {
    if (!featureEntryActive(valueId, entry)) return []
    const item = itemsById.get(String(entry.id))
    if (!item) return []
    const ownerLevel = abilityOwnerLevel(item.data || {}, values)
    return asArray(item.data?.derived_effects).flatMap((rule, index) => {
      if (!rule?.kind || ownerLevel < Math.max(1, number(rule.level, 1))) return []
      return [{
        ...rule,
        key: `${valueId}:${entry.uid || entry.id}:derived:${index}`,
        ownerLevel,
        source_label: item.name || 'Способность',
        source_entry: entry,
      }]
    })
  }))
  return [...ownedEffects, ...collectStatusDerivedEffects(values, itemsById)]
}

export function matchingDerivedEffects(effects, kind, context = {}) {
  return asArray(effects).filter(rule => rule.kind === kind && contextMatches(rule, rule.source_entry, context))
}

export function derivedArmorRules(effects) {
  return {
    formulas: matchingDerivedEffects(effects, 'armor_formula'),
    bonuses: matchingDerivedEffects(effects, 'armor_bonus'),
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
    sources: active,
  }
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
    return targets.map((targetId) => ({ targetId, source: rule.source_label }))
  })
}

export function derivedNumericBonus(effects, kind, values, context = {}) {
  const active = matchingDerivedEffects(effects, kind, context)
  const total = active.reduce((sum, rule) => {
    let value = number(rule.value)
    const stat = SUGGEST16_TO_STAT[number(rule.ability_modifier)]
    if (stat) value += abilityModifier(resolveNumValue(values?.[stat]?.value))
    if (rule.proficiency_multiplier != null) {
      const stored = values?.prof_bonus || {}
      const mastery = stored?.auto === false ? number(stored.v) : proficiencyBonus(values?.lvl?.level)
      value += Math.floor((mastery + sumBonuses(stored?.bonuses)) * number(rule.proficiency_multiplier))
    }
    return sum + value
  }, 0)
  return { total, sources: active }
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
