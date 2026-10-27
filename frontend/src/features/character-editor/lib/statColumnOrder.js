// Six characteristic tiles: keep each column readable and minimize height imbalance.
export function statColumnOrder(heights, columns, gap = 12) {
  if (columns <= 1 || heights.length < 2) return heights.map((_, index) => index)
  const count = Math.min(columns, heights.length, 3)
  const groups = Array.from({ length: count }, () => [])
  let best = [], spread = Infinity
  function visit(index, used) {
    if (index === heights.length) {
      if (groups.some(group => !group.length)) return
      const sums = groups.map(group => group.reduce((sum, entry) => sum + heights[entry], 0) + gap * (group.length - 1))
      const range = Math.max(...sums) - Math.min(...sums)
      if (range < spread) { spread = range; best = groups.flat() }
      return
    }
    for (let column = 0; column < Math.min(count, used + 1); column++) {
      groups[column].push(index)
      visit(index + 1, Math.max(used, column + 1))
      groups[column].pop()
    }
  }
  visit(0, 0)
  return best
}

export function statTileWeights(definition, values) {
  return ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(id => {
    const skills = new Set([...(definition?.blocks?.[id]?.content?.suggest_ids || []).map(String), ...Object.keys(values?.[id]?.skills || {})])
    return 116 + skills.size * 34
  })
}
