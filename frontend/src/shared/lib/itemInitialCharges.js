/** Catalogue rules describe a starting stock; only the owned instance holds its result. */
export function validChargeCount(value) {
  return ['number', 'string'].includes(typeof value) && value !== null && value !== undefined && String(value).trim() !== ''
    && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100
}
export function hasInitialChargeStock(params, key = '') { return validChargeCount(key ? params?.magic?.resource_maxima?.[key] : params?.magic?.max_use) }
export function initialChargeStocks(data = {}) {
  if (data?.use_resources?.length) return data.use_resources.filter(row => row.key && row.initial_charges).map(row => ({ key: row.key, title: row.title || row.key, rule: row.initial_charges }))
  return data?.initial_charges ? [{ key: '', title: 'Начальный запас зарядов', rule: data.initial_charges }] : []
}
export function initialChargeRuleError(rule) {
  if (!rule) return ''
  if (rule.mode === 'fixed') return validChargeCount(rule.value) ? '' : 'Укажите целое число зарядов от 0 до 100.'
  if (rule.mode !== 'roll') return 'Выберите способ определения начального запаса.'
  const formula = String(rule.formula || '').replace(/\s/g, '').replace(/[кКD]/g, 'd').replace(/[−–—]/g, '-')
  if (!/^(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(formula)) return 'Укажите формулу, например 1к4−1.'
  let minimum = 0, maximum = 0
  for (const term of formula.match(/[+-]?[^+-]+/g)) {
    const sign = term.startsWith('-') ? -1 : 1, body = term.replace(/^[+-]/, '')
    let low, high
    if (!body.includes('d')) low = high = Number(body)
    else {
      const [count, sides] = body.split('d').map((value, i) => Number(value || (i ? 0 : 1)))
      if (count < 1 || sides < 2 || count > 100 || sides > 1000) return 'Проверьте число и грани костей.'
      low = count; high = count * sides
    }
    if (!Number.isSafeInteger(high)) return 'Проверьте формулу начального запаса.'
    minimum += sign * (sign > 0 ? low : high)
    maximum += sign * (sign > 0 ? high : low)
  }
  return minimum >= 0 && maximum <= 100 ? '' : 'Все результаты начального запаса должны быть от 0 до 100 зарядов.'
}
export function initialChargeDefault(rule) {
  return rule?.mode === 'fixed' && validChargeCount(rule.value) ? Number(rule.value) : ''
}
/** Never refill or reroll an initialized instance, including an empty one. */
export function initializeItemCharges(params = {}, value, key = '') {
  if (hasInitialChargeStock(params, key) || !validChargeCount(value)) return JSON.parse(JSON.stringify(params))
  if (key) {
    const next = JSON.parse(JSON.stringify(params)), state = next.magic || {}
    next.magic = { ...state, resource_maxima: { ...state.resource_maxima, [key]: Number(value) }, resource_counts: { ...state.resource_counts, [key]: Number(value) } }
    return next
  }
  return { ...JSON.parse(JSON.stringify(params)), magic: { ...JSON.parse(JSON.stringify(params.magic || {})), max_use: Number(value), remaining: Number(value) } }
}
