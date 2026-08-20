function nodeCenter(node, size) {
  return {
    x: node.positionX + size.width / 2,
    y: node.positionY + size.height / 2,
  }
}

function connectionAxis(fromCenter, toCenter, horizontalReach, verticalReach) {
  const horizontalDistance = Math.abs(toCenter.x - fromCenter.x) / Math.max(1, horizontalReach)
  const verticalDistance = Math.abs(toCenter.y - fromCenter.y) / Math.max(1, verticalReach)
  return horizontalDistance >= verticalDistance ? 'horizontal' : 'vertical'
}

function curveGeometry(start, end, axis, direction) {
  if (axis === 'horizontal') {
    const bend = Math.max(70, Math.abs(end.x - start.x) * 0.45)
    return {
      start,
      end,
      path: `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`,
    }
  }
  const bend = Math.max(70, Math.abs(end.y - start.y) * 0.45)
  return {
    start,
    end,
    path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * bend}, ${end.x} ${end.y - direction * bend}, ${end.x} ${end.y}`,
  }
}

export function graphEdgeGeometry(from, to, dimensionsFor) {
  const fromSize = dimensionsFor(from)
  const toSize = dimensionsFor(to)
  const fromCenter = nodeCenter(from, fromSize)
  const toCenter = nodeCenter(to, toSize)
  const axis = connectionAxis(
    fromCenter,
    toCenter,
    (fromSize.width + toSize.width) / 2,
    (fromSize.height + toSize.height) / 2,
  )
  if (axis === 'horizontal') {
    const direction = toCenter.x >= fromCenter.x ? 1 : -1
    return curveGeometry(
      { x: fromCenter.x + direction * fromSize.width / 2, y: fromCenter.y },
      { x: toCenter.x - direction * toSize.width / 2, y: toCenter.y },
      axis,
      direction,
    )
  }
  const direction = toCenter.y >= fromCenter.y ? 1 : -1
  return curveGeometry(
    { x: fromCenter.x, y: fromCenter.y + direction * fromSize.height / 2 },
    { x: toCenter.x, y: toCenter.y - direction * toSize.height / 2 },
    axis,
    direction,
  )
}

export function graphEdgePath(from, to, dimensionsFor) {
  return graphEdgeGeometry(from, to, dimensionsFor).path
}

export function graphEdgePathToPoint(from, point, dimensionsFor) {
  const fromSize = dimensionsFor(from)
  const fromCenter = nodeCenter(from, fromSize)
  const axis = connectionAxis(fromCenter, point, fromSize.width / 2, fromSize.height / 2)
  if (axis === 'horizontal') {
    const direction = point.x >= fromCenter.x ? 1 : -1
    return curveGeometry(
      { x: fromCenter.x + direction * fromSize.width / 2, y: fromCenter.y },
      point,
      axis,
      direction,
    ).path
  }
  const direction = point.y >= fromCenter.y ? 1 : -1
  return curveGeometry(
    { x: fromCenter.x, y: fromCenter.y + direction * fromSize.height / 2 },
    point,
    axis,
    direction,
  ).path
}

export function graphEdgePathFromPoint(point, to, dimensionsFor) {
  const toSize = dimensionsFor(to)
  const toCenter = nodeCenter(to, toSize)
  const axis = connectionAxis(point, toCenter, toSize.width / 2, toSize.height / 2)
  if (axis === 'horizontal') {
    const direction = toCenter.x >= point.x ? 1 : -1
    return curveGeometry(
      point,
      { x: toCenter.x - direction * toSize.width / 2, y: toCenter.y },
      axis,
      direction,
    ).path
  }
  const direction = toCenter.y >= point.y ? 1 : -1
  return curveGeometry(
    point,
    { x: toCenter.x, y: toCenter.y - direction * toSize.height / 2 },
    axis,
    direction,
  ).path
}

export function graphEdgeMidpoint(from, to, dimensionsFor) {
  const fromSize = dimensionsFor(from)
  const toSize = dimensionsFor(to)
  return {
    x: (from.positionX + fromSize.width / 2 + to.positionX + toSize.width / 2) / 2,
    y: (from.positionY + fromSize.height / 2 + to.positionY + toSize.height / 2) / 2,
  }
}
