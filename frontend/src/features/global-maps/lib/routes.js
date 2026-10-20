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

// Each leg owns its geometry and dash phase; neighbouring stops cannot reshape it.
export function routeLegs(points, width, height) {
  const legs = []
  let start = 0
  for (let end = 1; end < points.length; end++) {
    if (points[end].control) continue
    const segments = routeSegments(points.slice(start, end + 1), width, height)
      .map(segment => ({ ...segment, index: segment.index + start }))
    legs.push({ id: `${points[start].id}:${points[end].id}`, path: joinSegments(segments), segments })
    start = end
  }
  return legs
}

// Keep bends only between visits that stay adjacent, reversing them for a return leg.
export function reorderVisits(route, ids) {
  const visits = route.points.filter(point => !point.control)
  if (ids.length !== visits.length || new Set(ids).size !== ids.length) return
  const byId = new Map(visits.map(point => [point.id, point]))
  if (ids.some(id => !byId.has(id))) return
  const bends = new Map()
  let previous, pending = []
  for (const point of route.points) {
    if (point.control) { pending.push(point); continue }
    if (previous) {
      bends.set(`${previous.id}:${point.id}`, pending)
      bends.set(`${point.id}:${previous.id}`, pending.toReversed())
    }
    previous = point; pending = []
  }
  route.points = ids.flatMap((id, index) => [...(index ? bends.get(`${ids[index - 1]}:${id}`) || [] : []), byId.get(id)])
}
