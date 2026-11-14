// Presentation of explicit prices in the catalogue's material text. Never totals or spends money.
const NUMBER = String.raw`\d(?:[\d., \u00a0\u202f]*\d)?`
const CURRENCY = String.raw`(?:[зсэмп]м|gp|sp|cp|ep|pp|(?:золот\p{L}*|серебр\p{L}*|медн\p{L}*|платин\p{L}*|электр\p{L}*)\s+монет\p{L}*|(?:gold|silver|copper|electrum|platinum)\s+pieces?|золотых|серебряных|медных|платиновых|электрумовых)`
const PRICE = new RegExp(String.raw`(?<![\p{L}\d−-])(?<amount>${NUMBER}(?:\s*[–-]\s*${NUMBER})?)\s*(?<currency>${CURRENCY})(?![\p{L}\d])\.?`, 'giu')
const QUALIFIER = String.raw`(?:как\s*минимум|не\s+(?:менее|меньше)|по\s+меньшей\s+мере|минимум|хотя\s+бы|в\s+сумме|всего|at\s+least)`
const COST_PREFIX = new RegExp(String.raw`(?:[,;]\s*)?\s*(?:стоимост[ьи]\p{L}*|стоящ\p{L}*|ценой|на|worth|costing)\s+(?:${QUALIFIER}\s+)*$`, 'iu')
const MINIMUM = /(?:как\s*минимум|не\s+(?:менее|меньше)|по\s+меньшей\s+мере|минимум|хотя\s+бы|at\s+least)\s*$/iu
const CONTEXT_DEPENDENT = /кажд|долж|(?:^|\s)за\s+(?:уров|круг|цел|существ)|(?:^|\s)или(?:\s|$)/iu

function currencyLabel(raw) {
  const unit = raw.toLocaleLowerCase('ru-RU')
  if (/^(зм|gp|золот|gold)/u.test(unit)) return 'зм'
  if (/^(см|sp|серебр|silver)/u.test(unit)) return 'см'
  if (/^(мм|cp|медн|copper)/u.test(unit)) return 'мм'
  if (/^(эм|ep|электр|electrum)/u.test(unit)) return 'эм'
  return 'пм'
}

export function spellMaterialRequirement(components) {
  if (!components?.m) return null
  const description = (typeof components.m === 'string' ? components.m.replace(/\s+/gu, ' ').trim() : '') || 'Материальный компонент'
  const prices = []
  for (const match of description.matchAll(PRICE)) {
    if (!/[1-9]/u.test(match.groups.amount)) continue
    const before = description.slice(0, match.index)
    const prefix = before.match(COST_PREFIX)
    const currency = currencyLabel(match.groups.currency)
    if (/^(золотых|серебряных|медных|платиновых|электрумовых)$/iu.test(match.groups.currency) && !prefix) continue
    // "см" and "мм" may describe dimensions rather than coins.
    if (/^(см|мм|пм)$/iu.test(match.groups.currency) && !prefix && description !== match[0].trim()) continue
    const amount = match.groups.amount.replace(/\s+/gu, ' ').trim()
    prices.push({ label: `${MINIMUM.test(before) ? 'от ' : ''}${amount} ${currency}`, match, prefix })
  }
  if (!prices.length) return {description,name:description,priceLabel:''}
  let name = description
  // Only simplify a single unambiguous price clause. Keep alternatives and per-unit rules verbatim.
  if (prices.length === 1 && !CONTEXT_DEPENDENT.test(description)) {
    const { match, prefix } = prices[0]
    if (prefix) name = description.slice(0, match.index - prefix[0].length) + description.slice(match.index + match[0].length)
    else if (/\(\s*$/u.test(description.slice(0, match.index)) && /^\s*\)/u.test(description.slice(match.index + match[0].length))) {
      name = description.slice(0, match.index).replace(/\(\s*$/u, '') + description.slice(match.index + match[0].length).replace(/^\s*\)/u, '')
    }
    name = name.replace(/[,;]\s*(?=(?:и|или)\s)/gu, ' ').replace(/\s+/gu, ' ').replace(/^[\s,;.]+|[\s,;.]+$/gu, '') || description
  }
  return { description, name, priceLabel: [...new Set(prices.map(price => price.label))].join(' · ') }
}
