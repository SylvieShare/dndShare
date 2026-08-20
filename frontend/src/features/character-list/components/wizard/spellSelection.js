export function spellSelectionComplete(chosen, limit) {
  const required = Math.max(0, Number(limit) || 0)
  return required === 0 || Number(chosen) === required
}
