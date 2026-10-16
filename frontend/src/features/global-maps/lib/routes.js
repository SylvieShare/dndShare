export const ROUTE_COLORS = ['#d4ae69', '#8fbbd9', '#b397df', '#86bb92', '#d88f9b', '#d69b73']
export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n))
export const uid = () => crypto.randomUUID()

export function routePath(points, width, height) {
  const p = points.map(point => ({ x: point.x * width, y: point.y * height }))
  if (p.length < 2) return ''
  const format = point => `${Number(point.x.toFixed(2))},${Number(point.y.toFixed(2))}`
  const constrain = point => ({ x: clamp(point.x, 0, width), y: clamp(point.y, 0, height) })
  let path = `M${format(p[0])}`
  if (p.length === 2) {
    const [a, b] = p, dx = b.x - a.x, dy = b.y - a.y
    const length = Math.hypot(dx, dy) || 1, bend = Math.min(90, length * .16)
    const offset = { x: -dy / length * bend, y: dx / length * bend }
    const c1 = constrain({ x: a.x + dx / 3 + offset.x, y: a.y + dy / 3 + offset.y })
    const c2 = constrain({ x: a.x + dx * 2 / 3 + offset.x, y: a.y + dy * 2 / 3 + offset.y })
    return `${path} C${format(c1)} ${format(c2)} ${format(b)}`
  }
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], before = p[i - 1] || a, after = p[i + 2] || b
    const c1 = constrain({ x: a.x + (b.x - before.x) / 6, y: a.y + (b.y - before.y) / 6 })
    const c2 = constrain({ x: b.x - (after.x - a.x) / 6, y: b.y - (after.y - a.y) / 6 })
    path += ` C${format(c1)} ${format(c2)} ${format(b)}`
  }
  return path
}

export function movePoint(route, id, delta) {
  const index = route.points.findIndex(point => point.id === id), next = index + delta
  if (index < 0 || next < 0 || next >= route.points.length) return
  const [point] = route.points.splice(index, 1)
  route.points.splice(next, 0, point)
}
