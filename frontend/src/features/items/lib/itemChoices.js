function asArray(value) {
  return Array.isArray(value) ? value : []
}

function number(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeChoice(choice, index, legacy = false) {
  const source = choice?.source
    || (choice?.from_suggest_id != null ? 'suggest' : null)
    || (choice?.from_item_type_id != null ? 'item' : null)
    || 'inline'
  return {
    ...choice,
    key: String(choice?.key || (legacy ? 'choice' : `choice_${index + 1}`)),
    count: Math.max(1, number(choice?.count) || 1),
    source,
    options: asArray(choice?.options),
  }
}

/**
 * Choices made when a handbook item is attached to a character.
 *
 * Race/class abilities historically used one `choice` object while feats use
 * the reusable `choices` array. New items use the array; the singular form is
 * kept as a read-compatible adapter for imported catalogue data.
 */
export function itemChoices(item) {
  const data = item?.data && typeof item.data === 'object' ? item.data : {}
  if (Array.isArray(data.choices)) {
    return data.choices.filter(Boolean).map((choice, index) => normalizeChoice(choice, index))
  }
  if (data.choice && typeof data.choice === 'object' && !Array.isArray(data.choice)) {
    return [normalizeChoice(data.choice, 0, true)]
  }
  return []
}

export function actionableItemChoices(item) {
  return itemChoices(item).filter((choice) => (
    (choice.source === 'suggest' && choice.from_suggest_id != null)
    || (choice.source === 'suggest_union' && asArray(choice.suggest_sources).length > 0)
    || (choice.source === 'item' && choice.from_item_type_id != null)
    || (choice.source === 'inline' && choice.options.length > 0)
  ))
}

/**
 * Flatten an item's choices into independently addressable UI rows.
 *
 * The historical single-choice state was keyed by the item id. Keep that key
 * for one choice so saved creation drafts remain valid; qualify the key only
 * when an item exposes several choices.
 */
export function itemChoiceRows(item) {
  const choices = actionableItemChoices(item)
  return choices.map((choice) => ({
    id: choices.length === 1 ? item.id : `${item.id}:${choice.key}`,
    abilityId: item.id,
    choiceKey: choice.key,
    name: item.name,
    choice,
  }))
}

export function choicesForEntry(item, selections = {}) {
  const result = {}
  for (const row of itemChoiceRows(item)) {
    const selected = asArray(selections[row.id])
    if (selected.length) result[row.choiceKey] = selected.slice()
  }
  return result
}

export function choiceSelectionsComplete(item, selections = {}) {
  return actionableItemChoices(item).every((choice) => {
    if (choice.depends_on_choice && !asArray(selections[choice.depends_on_choice]).length) return false
    return asArray(selections[choice.key]).length === choice.count
  })
}

export function parseItemChoiceFilter(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { /* use key=value shorthand */ }
  const [key, ...rest] = String(raw).split('=')
  return key && rest.length ? { [key.trim()]: rest.join('=').trim() } : null
}

export function resolvedItemChoiceFilter(choice, selections = {}) {
  const base = parseItemChoiceFilter(choice?.item_filter) || {}
  const dynamic = choice?.item_filter_from_choice
  if (!dynamic?.path || !dynamic?.choice_key) return base
  const selected = asArray(selections[dynamic.choice_key])
  if (!selected.length) return null
  return { ...base, [dynamic.path]: selected.length === 1 ? selected[0] : selected }
}

function valuesAtPath(value, segments) {
  if (!segments.length) return Array.isArray(value) ? value.flatMap((entry) => valuesAtPath(entry, [])) : [value]
  if (Array.isArray(value)) return value.flatMap((entry) => valuesAtPath(entry, segments))
  if (value == null || typeof value !== 'object') return []
  return valuesAtPath(value[segments[0]], segments.slice(1))
}

export function itemMatchesChoiceFilter(item, raw) {
  const filter = parseItemChoiceFilter(raw)
  if (!filter) return true
  return Object.entries(filter).every(([key, expected]) => {
    const actual = valuesAtPath(item?.data, String(key).split('.'))
    const allowed = Array.isArray(expected) ? expected : [expected]
    return actual.some((candidate) => allowed.some((value) => String(value) === String(candidate)))
  })
}
