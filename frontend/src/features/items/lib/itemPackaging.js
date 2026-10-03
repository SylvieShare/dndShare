export function purchaseQuantity(item) {
  const quantity = Number(item?.data?.purchase_quantity)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

export function packagingNote(item) {
  const quantity = purchaseQuantity(item)
  return quantity > 1 ? `за ${quantity} шт.` : ''
}

const rounded = value => Math.round(value * 1e8) / 1e8

function scaledCost(cost, factor) {
  if (!cost || typeof cost !== 'object') return cost
  return Object.fromEntries(Object.entries(cost).map(([key, value]) => [
    key,
    ['value', 'min', 'max'].includes(key) && value != null && value !== '' && Number.isFinite(Number(value))
      ? rounded(Number(value) * factor)
      : value,
  ]))
}

// Overrides describe one owned unit; catalogue cost/weight describe one purchase.
export function inventoryItemEconomy(item, entry = {}) {
  const data = item?.data || {}, override = entry.override || {}, params = entry.params || {}
  const count = Math.max(1, Number(entry.count) || 1)
  const quantity = purchaseQuantity(item)
  const length = Number(params.length_ft)
  const measuredCost = Number.isFinite(length) && length > 0 && data.unit_cost_copper != null
    ? { value: length * Number(data.unit_cost_copper), suggest_id: 1 } : null
  const measuredWeight = Number.isFinite(length) && length > 0 && data.unit_weight != null
    ? length * Number(data.unit_weight) : null
  const cost = override.cost ?? measuredCost ?? data.cost ?? null
  const weight = override.weight ?? measuredWeight ?? data.weight ?? null
  const costFactor = override.cost != null || measuredCost != null ? count : count / quantity
  const weightFactor = override.weight != null || measuredWeight != null ? count : count / quantity
  return {
    cost: scaledCost(cost, costFactor),
    weight: weight == null ? null : rounded(Number(weight) * weightFactor),
  }
}
