/** Canonical handbook references granted by a D&D background. */

export const COIN_ORDER = [1, 2, 3, 4, 5]

const COIN_LABELS = { 1: 'мм', 2: 'см', 3: 'зм', 4: 'эм', 5: 'пм' }

function equipmentData(background) {
  return background?.item?.data || background?.data || {}
}

function referenceRows(background, key) {
  const rows = equipmentData(background)[key]
  return Array.isArray(rows) ? rows : []
}

function catalogueMap(catalogue) {
  return new Map((catalogue || []).map((item) => [String(item.id), item]))
}

function inventoryEntry(item, count = 1) {
  return {
    item_id: item.id,
    name: item.name,
    nameEn: item.nameEn || '',
    count: Math.max(1, Math.floor(Number(count) || 1)),
    params: {},
    typeId: item.typeId,
    armor: item.data?.armor || null,
    data: item.data || {},
    iconImageUrl: item.iconImageUrl || null,
    svg: item.svg || null,
    coverImageUrl: item.coverImageUrl || null,
  }
}

function choiceRows(background) {
  const rows = equipmentData(background).item_choices
  return Array.isArray(rows) ? rows : []
}

export function backgroundChoiceProfile(background, catalogue = []) {
  const byId = catalogueMap(catalogue)
  const choices = choiceRows(background).map((definition) => ({
    ...definition,
    key: String(definition?.key || ''),
    label: String(definition?.label || 'Выбор предыстории'),
    options: (Array.isArray(definition?.option_item_ids) ? definition.option_item_ids : [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean),
  })).filter((definition) => definition.key)
  return choices.length ? { choices } : null
}

function activeChoiceDefinitions(profile, includeEquipment = true) {
  return (profile?.choices || []).filter((definition) => (
    definition.grants_tool_proficiency === true
    || (includeEquipment && definition.grants_equipment_item === true)
  ))
}

function selectedChoiceItem(definition, selections = {}) {
  const saved = selections?.[definition.key]
  return definition.options.find((item) => String(item.id) === String(saved)) || null
}

export function backgroundChoicesComplete(profile, selections = {}, { includeEquipment = true } = {}) {
  return activeChoiceDefinitions(profile, includeEquipment)
    .every((definition) => !!selectedChoiceItem(definition, selections))
}

export function activeBackgroundChoices(profile, includeEquipment = true) {
  return activeChoiceDefinitions(profile, includeEquipment)
}

function applySelectedChoices(rows, profile, selections, grantKey, replacementKey) {
  const next = [...rows]
  for (const definition of (profile?.choices || [])) {
    if (definition?.[grantKey] !== true) continue
    const replacementId = definition?.[replacementKey]
    const selected = selectedChoiceItem(definition, selections)
    if (replacementId != null) {
      const index = next.findIndex((entry) => String(entry.item_id) === String(replacementId))
      if (index >= 0) {
        next.splice(index, 1, ...(selected ? [inventoryEntry(selected)] : []))
        continue
      }
    }
    if (selected) next.push(inventoryEntry(selected))
  }
  return next
}

export function backgroundToolProficiencySelections(profile, selections = {}) {
  return (profile?.choices || []).flatMap((definition) => {
    if (definition.grants_tool_proficiency !== true) return []
    const selected = selectedChoiceItem(definition, selections)
    if (!selected) return []
    const replaces = Number(definition.replace_tool_prof_id)
    return [{ ...(Number.isInteger(replaces) ? { replaces } : {}), name: selected.name }]
  })
}

function resolveRows(background, key, catalogue) {
  const byId = catalogueMap(catalogue)
  return referenceRows(background, key)
    .map((row) => {
      const item = byId.get(String(row?.item_id))
      return item ? { ...inventoryEntry(item, row?.count), params: { ...(row?.params || {}) } } : null
    })
    .filter(Boolean)
}

export function backgroundReferenceIds(background) {
  const choiceReferences = choiceRows(background).flatMap((definition) => [
    ...(Array.isArray(definition?.option_item_ids) ? definition.option_item_ids : []),
    definition?.replace_tool_item_id,
    definition?.replace_equipment_item_id,
  ])
  return [...new Set([
    ...referenceRows(background, 'tool_items').map((row) => row?.item_id),
    ...referenceRows(background, 'equipment_items').map((row) => row?.item_id),
    ...choiceReferences,
  ]
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))]
}

export function backgroundToolItems(background, catalogue = [], selections = {}) {
  const profile = backgroundChoiceProfile(background, catalogue)
  return applySelectedChoices(
    resolveRows(background, 'tool_items', catalogue),
    profile,
    selections,
    'grants_tool_item',
    'replace_tool_item_id',
  )
}

export function backgroundStartingEquipment(background, catalogue = [], selections = {}) {
  const data = equipmentData(background)
  const profile = backgroundChoiceProfile(background, catalogue)
  const items = applySelectedChoices(
    resolveRows(background, 'equipment_items', catalogue),
    profile,
    selections,
    'grants_equipment_item',
    'replace_equipment_item_id',
  )
  const coins = {}

  for (const row of (Array.isArray(data.starting_coins) ? data.starting_coins : [])) {
    const currencyId = Number(row?.currency_id)
    const amount = Number(row?.amount)
    if (!COIN_ORDER.includes(currencyId) || !Number.isFinite(amount) || amount <= 0) continue
    coins[currencyId] = (Number(coins[currencyId]) || 0) + amount
  }

  return { items, coins, gold: Number(coins[3]) || 0 }
}

export function formatStartingCoins(coins = {}) {
  return COIN_ORDER
    .filter((id) => Number(coins[id]) > 0)
    .map((id) => `${Number(coins[id])} ${COIN_LABELS[id]}`)
    .join(', ')
}

export function addStartingCoins(value, additions = {}) {
  const amounts = value?.amounts && typeof value.amounts === 'object' ? { ...value.amounts } : {}
  const order = Array.isArray(value?.order) ? [...value.order] : []

  for (const id of COIN_ORDER) {
    if (!order.some((saved) => String(saved) === String(id))) order.push(id)
  }
  for (const [id, amount] of Object.entries(additions)) {
    amounts[id] = (Number(amounts[id]) || 0) + (Number(amount) || 0)
  }

  return { amounts, order }
}
