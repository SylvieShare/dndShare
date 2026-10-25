import { parseDiceExpression } from './dice'

// Presentation only: unknown faces must never become a roll or a journal event.
export function pendingDiceResult(expression) {
  return {
    pending: true,
    expression,
    parts: parseDiceExpression(expression).map(part => part.kind === 'dice'
      ? { ...part, rolls: Array(part.n).fill(null) }
      : { ...part, sum: part.value }),
    total: null,
    byType: [],
  }
}

export function d20Expression(bonus = 0, mode = 'normal', bonusFormula = '') {
  const modifier = Number(bonus) || 0
  return `${['advantage', 'disadvantage'].includes(mode) ? 2 : 1}d20${modifier >= 0 ? '+' : ''}${modifier}${bonusFormula ? ` + ${bonusFormula}` : ''}`
}
