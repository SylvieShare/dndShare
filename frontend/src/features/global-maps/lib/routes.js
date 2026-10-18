export const ROUTE_COLORS = ['#d4ae69', '#8fbbd9', '#b397df', '#86bb92', '#d88f9b', '#d69b73']
export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n))
export const uid = () => crypto.randomUUID()

export function routeSegments(points, width, height) {
  const p = points.map(point => ({ x: point.x * width, y: point.y * height }))
  const format = point => `${Number(point.x.toFixed(2))},${Number(point.y.toFixed(2))}`
  const constrain = point => ({ x: clamp(point.x, 0, width), y: clamp(point.y, 0, height) })
  const segments = []
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], before = p[i - 1] || a, after = p[i + 2] || b
    let c1, c2
    if (p.length === 2) {
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1
      const bend = Math.min(90, length * .16), offset = { x: -dy / length * bend, y: dx / length * bend }
      c1 = constrain({ x: a.x + dx / 3 + offset.x, y: a.y + dy / 3 + offset.y })
      c2 = constrain({ x: a.x + dx * 2 / 3 + offset.x, y: a.y + dy * 2 / 3 + offset.y })
    } else {
      c1 = constrain({ x: a.x + (b.x - before.x) / 6, y: a.y + (b.y - before.y) / 6 })
      c2 = constrain({ x: b.x - (after.x - a.x) / 6, y: b.y - (after.y - a.y) / 6 })
    }
    segments.push({ index: i, path: `M${format(a)} C${format(c1)} ${format(c2)} ${format(b)}` })
  }
  return segments
}

export const joinSegments = segments => segments.map((segment, index) => index ? segment.path.slice(segment.path.indexOf(' C')) : segment.path).join('')

export function routePath(points, width, height) {
  return joinSegments(routeSegments(points, width, height))
}

export function movePoint(route, id, delta) {
  const indices = route.points.map((point, index) => point.control ? -1 : index).filter(index => index >= 0)
  const position = indices.findIndex(index => route.points[index].id === id), next = position + delta
  if (position < 0 || next < 0 || next >= indices.length) return
  const a = indices[position], b = indices[next]
  ;[route.points[a], route.points[b]] = [route.points[b], route.points[a]]
}
