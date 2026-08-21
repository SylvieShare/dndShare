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
  return [...referenceRows(background, 'tool_items'), ...referenceRows(background, 'equipment_items')]
    .map((row) => Number(row?.item_id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function backgroundToolItems(background, catalogue = []) {
  return resolveRows(background, 'tool_items', catalogue)
}

export function backgroundStartingEquipment(background, catalogue = []) {
  const data = equipmentData(background)
  const items = resolveRows(background, 'equipment_items', catalogue)
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
