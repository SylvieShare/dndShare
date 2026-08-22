import { STAT_KEYS } from '@/shared/lib/dndStats'
import { collectCharacterDerivedEffects, derivedProficiency } from '@/features/character-editor/lib/characterDerivedEffects'

function asArray(value) { return Array.isArray(value) ? value : [] }

export function choiceTarget(value) {
  const raw = String(value ?? '')
  const separator = raw.indexOf(':')
  return separator < 0
    ? { prefix: '', id: raw }
    : { prefix: raw.slice(0, separator), id: raw.slice(separator + 1) }
}

function skillStoredRank(values, skillId) {
  for (const stat of STAT_KEYS) {
    const rank = Number(values?.[stat]?.skills?.[String(skillId)]?.up) || 0
    if (rank) return rank
  }
  return 0
}

function toolStoredRank(values, toolId, suggestItems) {
  const label = asArray(suggestItems?.(5)).find((entry) => String(entry.id) === String(toolId))?.value
  if (!label) return 0
  const owned = new Set(asArray(values?.proficiencies?.['Инструменты'])
    .map((entry) => String(entry?.name ?? entry?.value ?? entry).trim().toLocaleLowerCase('ru')))
  return owned.has(String(label).trim().toLocaleLowerCase('ru')) ? 1 : 0
}

export function characterChoiceTargetRank(value, { values = {}, items = [], suggestItems } = {}) {
  const { prefix, id } = choiceTarget(value)
  const itemMap = items instanceof Map
    ? items
    : new Map(asArray(items).filter((item) => item?.id != null).map((item) => [String(item.id), item]))
  const effects = collectCharacterDerivedEffects(values, itemMap)
  if (prefix === 'skill') {
    return Math.max(
      skillStoredRank(values, id),
      derivedProficiency(effects, 'skill_proficiency', { kind: 'skill_check', skillId: id }).rank,
    )
  }
  if (prefix === 'tool') {
    return Math.max(
      toolStoredRank(values, id, suggestItems),
      derivedProficiency(effects, 'tool_proficiency', { kind: 'tool', targetId: id }).rank,
    )
  }
  return 0
}

/** Data-driven eligibility for character-bound handbook choices. */
export function characterChoiceOptionEligibility(choice, value, context = {}) {
  const rank = characterChoiceTargetRank(value, context)
  if (choice?.requires_proficiency && rank < 1) {
    return { eligible: false, reason: 'Сначала нужно получить владение' }
  }
  const excludedRank = Number(choice?.exclude_rank)
  if (Number.isFinite(excludedRank) && excludedRank > 0 && rank >= excludedRank) {
    return { eligible: false, reason: `Уже имеет ранг владения ${excludedRank}` }
  }
  return { eligible: true, reason: '' }
}
