export function graphEdgePath(from, to, dimensionsFor) {
  const fromSize = dimensionsFor(from)
  const toSize = dimensionsFor(to)
  const fromCenterX = from.positionX + fromSize.width / 2
  const fromCenterY = from.positionY + fromSize.height / 2
  const toCenterX = to.positionX + toSize.width / 2
  const toCenterY = to.positionY + toSize.height / 2
  const direction = toCenterX >= fromCenterX ? 1 : -1
  const startX = fromCenterX + direction * fromSize.width / 2
  const endX = toCenterX - direction * toSize.width / 2
  const bend = Math.max(70, Math.abs(endX - startX) * 0.45)
  return `M ${startX} ${fromCenterY} C ${startX + direction * bend} ${fromCenterY}, ${endX - direction * bend} ${toCenterY}, ${endX} ${toCenterY}`
}

export function graphEdgeMidpoint(from, to, dimensionsFor) {
  const fromSize = dimensionsFor(from)
  const toSize = dimensionsFor(to)
  return {
    x: (from.positionX + fromSize.width / 2 + to.positionX + toSize.width / 2) / 2,
    y: (from.positionY + fromSize.height / 2 + to.positionY + toSize.height / 2) / 2,
  }
}
