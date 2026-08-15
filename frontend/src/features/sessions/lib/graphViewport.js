export const GRAPH_CAMERA_MARGIN = Object.freeze({ x: 320, y: 240 })

export function graphContentBounds(nodes, dimensionsFor) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const x = Number(node?.positionX)
    const y = Number(node?.positionY)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const dimensions = dimensionsFor(node)
    const width = Number(dimensions?.width)
    const height = Number(dimensions?.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}

export function clampGraphPan({ pan, zoom, frame, bounds, margin = GRAPH_CAMERA_MARGIN }) {
  const frameLeft = Number(frame?.left)
  const frameWidth = Number(frame?.width)
  const frameHeight = Number(frame?.height)
  if (!bounds || !Number.isFinite(zoom) || zoom <= 0
    || !Number.isFinite(frameLeft) || !Number.isFinite(frameWidth) || frameWidth <= 0
    || !Number.isFinite(frameHeight) || frameHeight <= 0) return { ...pan }
  const screenCenterX = frameLeft + frameWidth / 2
  const screenCenterY = frameHeight / 2
  const cameraCenterX = (screenCenterX - pan.x) / zoom
  const cameraCenterY = (screenCenterY - pan.y) / zoom
  const boundedCenterX = Math.max(bounds.minX - margin.x, Math.min(bounds.maxX + margin.x, cameraCenterX))
  const boundedCenterY = Math.max(bounds.minY - margin.y, Math.min(bounds.maxY + margin.y, cameraCenterY))

  return {
    x: screenCenterX - boundedCenterX * zoom,
    y: screenCenterY - boundedCenterY * zoom,
  }
}
