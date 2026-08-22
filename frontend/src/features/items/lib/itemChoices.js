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
  return actionableItemChoices(item).every((choice) => asArray(selections[choice.key]).length === choice.count)
}
