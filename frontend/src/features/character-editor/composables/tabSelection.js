export function tabSelectionWeights(count, indexes, position) {
  const weights = Array(count).fill(0)
  if (!indexes.length) return weights
  const slot = Math.max(0, Math.min(indexes.length - 1, position))
  const from = Math.floor(slot), to = Math.min(indexes.length - 1, from + 1)
  weights[indexes[from]] += 1 - (slot - from)
  weights[indexes[to]] += slot - from
  return weights
}
