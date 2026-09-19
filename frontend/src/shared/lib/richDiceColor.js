import { parseDiceExpression } from './dice'

// Match the healing formula, leaving unrelated rolls (damage, duration, etc.) alone.
export function richDiceColor(formula, item) {
  const usable = item?.data?.usable
  if (!usable) return null
  const parts = parseDiceExpression(formula)
  if (!parts.length) return null
  const signature = JSON.stringify(parts)
  for (const [key, color] of [['healing', 'var(--success)'], ['temporary_hp', 'var(--info)']]) {
    if (usable[key] && signature === JSON.stringify(parseDiceExpression(usable[key]))) return color
  }
  return null
}
