/** Catalogue rules describe a starting stock; only the owned instance holds its result. */
export function validChargeCount(value) {
  return ['number', 'string'].includes(typeof value) && value !== null && value !== undefined && String(value).trim() !== ''
    && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100
}
export function hasInitialChargeStock(params) { return validChargeCount(params?.magic?.max_use) }
export function initialChargeRuleError(rule) {
  if (!rule) return ''
  if (rule.mode === 'fixed') return validChargeCount(rule.value) ? '' : 'Укажите целое число зарядов от 0 до 100.'
  if (rule.mode !== 'roll') return 'Выберите способ определения начального запаса.'
  const formula = String(rule.formula || '').replace(/\s/g, '').replace(/[кКD]/g, 'd')
  if (!/^(?:\d*d\d+|\d+)(?:\+(?:\d*d\d+|\d+))*$/.test(formula)) return 'Укажите формулу, например 1к8+1.'
  let maximum = 0
  for (const term of formula.split('+')) {
    if (!term.includes('d')) maximum += Number(term)
    else {
      const [count, sides] = term.split('d').map((value, i) => Number(value || (i ? 0 : 1)))
      if (count < 1 || sides < 2 || !Number.isSafeInteger(count * sides)) return 'Проверьте число и грани костей.'
      maximum += count * sides
    }
  }
  return maximum <= 100 ? '' : 'Начальный запас не должен превышать 100 зарядов.'
}
export function initialChargeDefault(rule) {
  return rule?.mode === 'fixed' && validChargeCount(rule.value) ? Number(rule.value) : ''
}
/** Never refill or reroll an initialized instance, including an empty one. */
export function initializeItemCharges(params = {}, value) {
  if (hasInitialChargeStock(params) || !validChargeCount(value)) return JSON.parse(JSON.stringify(params))
  return { ...JSON.parse(JSON.stringify(params)), magic: { ...JSON.parse(JSON.stringify(params.magic || {})), max_use: Number(value), remaining: Number(value) } }
}
