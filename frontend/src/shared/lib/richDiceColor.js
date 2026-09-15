import { parseDiceExpression } from './dice'

// Match the healing formula, leaving unrelated rolls (damage, duration, etc.) alone.
export function richDiceColor(formula, item) {
  const consumption = item?.data?.consumption
  if (!consumption) return null
  const parts = parseDiceExpression(formula)
  if (!parts.length) return null
  const signature = JSON.stringify(parts)
  for (const [key, color] of [['healing', 'var(--success)'], ['temporary_hp', 'var(--info)']]) {
    if (consumption[key] && signature === JSON.stringify(parseDiceExpression(consumption[key]))) return color
  }
  return null
}
