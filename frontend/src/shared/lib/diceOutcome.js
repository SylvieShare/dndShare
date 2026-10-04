const outcomes = new WeakMap()

export function rememberDiceOutcome(result, outcome) {
  outcomes.set(result, outcome || null)
}

export function diceOutcome(result) {
  return outcomes.get(result) || null
}
