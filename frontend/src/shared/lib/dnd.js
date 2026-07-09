// Pure D&D 5e math helpers. Single source of truth — do not re-implement these
// inline (the ability-modifier and bonus formulas were previously copy-pasted
// across character-editor, sessions and items, which risks silent divergence).

/** Ability modifier from a raw score: floor((score - 10) / 2). Non-numeric → 0. */
export function abilityModifier(score) {
  const n = Number(score) || 0
  return Math.floor((n - 10) / 2)
}

/** Proficiency bonus by character level (clamped 1..20): ceil(level / 4) + 1. */
export function proficiencyBonus(level) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1))
  return Math.ceil(lvl / 4) + 1
}

/** Signed display string for a bonus: 3 → "+3", -1 → "-1", 0 → "+0". */
export function formatBonus(value) {
  const n = Number(value) || 0
  return (n >= 0 ? '+' : '') + n
}

/** d20 roll expression with a signed modifier: 0 → "d20", 3 → "d20+3", -2 → "d20-2". */
export function d20Expr(bonus) {
  const n = Number(bonus) || 0
  return n === 0 ? 'd20' : `d20${n > 0 ? '+' : '-'}${Math.abs(n)}`
}
