import { resolveNumValue } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT, STAT_FULL, STAT_KEYS } from '@/shared/lib/dndStats'
import { abilityUseTotal } from '@/shared/lib/dndAbilityUses'

const ABILITY_ID_BY_STAT = Object.fromEntries(
  Object.entries(SUGGEST16_TO_STAT).map(([id, stat]) => [stat, Number(id)]),
)

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function number(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function featData(item) {
  return item?.data && typeof item.data === 'object' ? item.data : {}
}

export function featDescription(item) {
  return featData(item).description || ''
}

export function featPrereq(item) {
  const data = featData(item)
  const value = data.prereq
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function featChoices(item) {
  return asArray(featData(item).choices).filter(Boolean).map((choice, index) => normalizeChoice(choice, index))
}

function normalizeChoice(choice, index) {
  const source = choice.source
    || (choice.from_suggest_id ? 'suggest' : null)
    || (choice.from_item_type_id ? 'item' : null)
    || 'inline'
  return {
    ...choice,
    key: String(choice.key || `choice_${index + 1}`),
    count: Math.max(1, number(choice.count) || 1),
    source,
    options: asArray(choice.options),
  }
}

export function abilityScoresFromValues(values = {}) {
  return Object.fromEntries(STAT_KEYS.map((stat) => [stat, resolveNumValue(values?.[stat]?.value)]))
}

function scoreFor(context, abilityId) {
  const stat = SUGGEST16_TO_STAT[number(abilityId)]
  if (!stat) return 0
  const raw = context?.stats?.[stat] ?? context?.stats?.[abilityId]
  return number(raw) || 0
}

function abilityRequirementLabel(row) {
  const stat = SUGGEST16_TO_STAT[number(row?.ability)]
  const value = number(row?.value) || 0
  return `${STAT_FULL[stat] || 'Характеристика'} ${value}`
}

/**
 * Checks the structured, mechanically verifiable part of a feat prerequisite.
 * A free-form `prereq.text` is deliberately display-only: it never blocks a
 * choice when no matching structured rule exists.
 */
export function evaluateFeatEligibility(item, context = {}) {
  const prereq = featPrereq(item)
  const reasons = []
  const minStats = asArray(prereq.min_stats).filter((row) => number(row?.ability) != null && number(row?.value) != null)
  if (minStats.length) {
    const checks = minStats.map((row) => scoreFor(context, row.ability) >= number(row.value))
    const mode = prereq.min_stats_mode === 'any' ? 'any' : 'all'
    const ok = mode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
    if (!ok) reasons.push(minStats.map(abilityRequirementLabel).join(mode === 'any' ? ' или ' : ' и '))
  }

  if (prereq.spellcasting && !context.spellcasting) reasons.push('Способность накладывать заклинания')

  const minLevel = number(prereq.min_level)
  if (minLevel != null && (number(context.level) || 0) < minLevel) reasons.push(`${minLevel} уровень`)

  const armorRequired = asArray(prereq.armor_prof).map(number).filter((id) => id != null)
  if (armorRequired.length) {
    const owned = new Set(asArray(context.armorProfIds).map(number).filter((id) => id != null))
    if (!armorRequired.every((id) => owned.has(id))) reasons.push('Требуемое владение доспехами')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    text: String(prereq.text || '').trim(),
    hasStructuredRules: minStats.length > 0 || !!prereq.spellcasting || minLevel != null || armorRequired.length > 0,
  }
}

export function choiceSelectionsComplete(item, selections = {}) {
  return featChoices(item).every((choice) => asArray(selections[choice.key]).length === choice.count)
}

export function featEntry(item, selections = {}, values = {}) {
  const data = featData(item)
  const entry = { id: item.id }
  const maxUse = abilityUseTotal(data, values, entry)
  entry.count = maxUse || 0
  if (data.repeatable) {
    entry.uid = globalThis.crypto?.randomUUID?.() || `feat_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
  if (data.manual_size) entry.max_use = maxUse || 0
  if (Object.keys(selections).length) entry.choices = selections
  return entry
}

export function featAbilityBonuses(item, selections = {}) {
  const data = featData(item)
  const bonuses = asArray(data.asi).map((row) => ({
    stat: SUGGEST16_TO_STAT[number(row?.ability)],
    bonus: number(row?.bonus) || 0,
  })).filter((row) => row.stat && row.bonus)

  const choice = data.asi_choice
  if (choice && typeof choice === 'object') {
    const choiceKey = String(choice.choice_key || 'ability')
    const bonus = number(choice.bonus) || 0
    for (const abilityId of asArray(selections[choiceKey])) {
      const stat = SUGGEST16_TO_STAT[number(abilityId)]
      if (stat && bonus) bonuses.push({ stat, bonus })
    }
  }

  // Some feats bind the effect to the same value the player selects. This
  // covers patterns such as Resilient without duplicating a second ASI picker.
  for (const featChoice of featChoices(item)) {
    const bonus = number(featChoice.ability_bonus) || 0
    if (!bonus) continue
    for (const abilityId of asArray(selections[featChoice.key])) {
      const stat = SUGGEST16_TO_STAT[number(abilityId)]
      if (stat) bonuses.push({ stat, bonus })
    }
  }
  return bonuses
}

export function featGrants(item, selections = {}) {
  const grants = featData(item).grants
  const result = grants && typeof grants === 'object' && !Array.isArray(grants)
    ? Object.fromEntries(Object.entries(grants).map(([key, values]) => [key, asArray(values).slice()]))
    : {}

  for (const choice of featChoices(item)) {
    const grantKey = String(choice.grant_proficiency || '')
    if (!grantKey) continue
    const values = result[grantKey] || []
    for (const selected of asArray(selections[choice.key])) {
      if (!values.some((value) => String(value) === String(selected))) values.push(selected)
    }
    result[grantKey] = values
  }
  return result
}

export function featGrantedSpellIds(item, selections = {}) {
  const ids = []
  for (const choice of featChoices(item)) {
    if (!choice.grant_spells) continue
    for (const selected of asArray(selections[choice.key])) {
      if (!ids.some((id) => String(id) === String(selected))) ids.push(selected)
    }
  }
  return ids
}

export function abilityIdForStat(stat) {
  return ABILITY_ID_BY_STAT[stat] ?? null
}
