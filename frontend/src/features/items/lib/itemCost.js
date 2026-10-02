export function isCostRange(cost) {
  return !!cost && typeof cost === 'object' && ('min' in cost || 'max' in cost)
}

const amount = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0

export function costError(cost) {
  if (!cost || typeof cost !== 'object') return ''
  if (isCostRange(cost)) {
    if (!amount(cost.min) || !amount(cost.max)) return 'Укажите обе неотрицательные границы цены.'
    if (Number(cost.min) > Number(cost.max)) return 'Нижняя граница цены не может превышать верхнюю.'
  }
  if (cost.value != null && !amount(cost.value)) return 'Укажите неотрицательную точную цену.'
  if (cost.value == null && !isCostRange(cost)) return cost.suggest_id ? 'Укажите точную цену или диапазон.' : ''
  return Number(cost.suggest_id) > 0 ? '' : 'Выберите валюту цены.'
}

export function costAmountLabel(cost) {
  if (cost == null || typeof cost !== 'object') return ''
  return amount(cost.value) ? String(cost.value) : ''
}

export function costRangeLabel(cost) {
  if (!isCostRange(cost) || !amount(cost.min) || !amount(cost.max) || Number(cost.min) > Number(cost.max)) return ''
  return Number(cost.min) === Number(cost.max) ? String(cost.min) : `${cost.min}–${cost.max}`
}

export function formatItemCost(cost, coin = '') {
  const value = costAmountLabel(cost), range = costRangeLabel(cost)
  const withCoin = amount => coin ? `${amount} ${coin}` : amount
  if (value && range) return `${withCoin(value)} · диапазон ${withCoin(range)}`
  return value || range ? withCoin(value || range) : ''
}
