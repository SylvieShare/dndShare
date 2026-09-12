// The queue owns 40% of the usable height; the active turn and graveyard own 60%.
// Downscale the whole composition when necessary so its typography still fits.
export function screenCombatLayout({ width, height }, displayScale, queueLength) {
  const padding = Math.min(width, height) * 0.03
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const requestedScale = Math.min(125, Math.max(75, Number(displayScale) || 100)) / 100
  const scale = Math.min(requestedScale, availableWidth / 900, availableHeight / 760)
  const logicalWidth = availableWidth / scale
  const logicalHeight = availableHeight / scale
  const gap = Math.min(34, Math.max(20, height * 0.022))
  const lowerHeight = (logicalHeight - gap) * 0.6
  const cardSize = Math.min(128, Math.max(108, width * 0.08))
  const cardGap = Math.min(10, Math.max(8, width * 0.006))
  const baseSlots = Math.max(1, Math.floor((logicalWidth - 10 + cardGap) / (cardSize + cardGap)))
  const stackReserve = queueLength > baseSlots ? 82 : 10
  return {
    queueSlots: Math.max(1, Math.floor((logicalWidth - stackReserve + cardGap) / (cardSize + cardGap))),
    graveyardSlots: Math.max(1, Math.floor((lowerHeight - 60) / 76)),
    style: {
      '--broadcast-scale': scale,
      '--combat-gap': `${gap}px`,
      '--spotlight-width': `${Math.min(700, Math.max(360, width * 0.46), lowerHeight * 4 / 3)}px`,
      width: `${logicalWidth}px`,
      height: `${logicalHeight}px`,
    },
  }
}
