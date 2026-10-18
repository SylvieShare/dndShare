import { uid } from './routes'

export const waypointEntries = route => route?.points.filter(point => !point.control) || []
export const lastWaypoint = route => waypointEntries(route).at(-1)
export const pointIndex = routes => new Map(routes.flatMap(route => route.points.filter(point => !point.refId).map(point => [point.id, point])))
export const resolvePoint = (entry, index) => entry?.refId ? index.get(entry.refId) : entry

export function routePoints(route, routes) {
  const index = pointIndex(routes)
  return route.points.map(entry => ({ ...resolvePoint(entry, index), id: entry.id, sourceId: entry.refId || entry.id }))
}

export function routeVisits(route, routes) {
  return routePoints(route, routes).filter(point => !point.control)
}

// One spatial marker can represent several visits, including visits in other routes.
export function mapMarkers(routes, selectedRoute, selectedPoint) {
  const index = pointIndex(routes), markers = new Map()
  for (const route of routes) {
    const tail = lastWaypoint(route)?.id
    let number = 0
    for (const [position, entry] of route.points.entries()) {
      const point = resolvePoint(entry, index)
      if (!point) continue
      if (!point.control) number++
      const key = point.id
      const visit = { ...point, id: entry.id, sourceId: key, routeId: route.id, routeName: route.name, color: route.color, position,
        number: point.control ? null : number,
        last: !point.control && entry.id === tail }
      if (!markers.has(key)) markers.set(key, [])
      markers.get(key).push(visit)
    }
  }
  return [...markers.values()].map(visits => {
    const preferred = visits.filter(visit => visit.routeId === selectedRoute)
    const local = preferred.length ? preferred : visits.filter(visit => visit.routeId === visits[0].routeId)
    const chosen = local.find(visit => visit.id === selectedPoint) || local.at(-1)
    return { ...chosen, last: local.some(visit => visit.last) && (!selectedRoute || chosen.routeId === selectedRoute), numbers: local.map(visit => visit.number), visits }
  })
}

export function appendVisit(route, source) {
  const sourceId = source.sourceId || source.refId || source.id
  if ((lastWaypoint(route)?.refId || lastWaypoint(route)?.id) === sourceId) return null
  const entry = { id: uid(), refId: sourceId }
  route.points.push(entry)
  return entry
}

export function removeEntries(routes, remove) {
  const definitions = pointIndex(routes)
  for (const route of routes) {
    route.points = route.points.filter(point => !remove(route, point))
    while (route.points[0]?.control) route.points.shift()
    while (route.points.at(-1)?.control) route.points.pop()
  }
  const retained = pointIndex(routes)
  for (const route of routes) for (let i = 0; i < route.points.length; i++) {
    const entry = route.points[i]
    if (entry.refId && !retained.has(entry.refId)) {
      const point = definitions.get(entry.refId)
      if (point) { route.points[i] = { ...point }; retained.set(point.id, route.points[i]) }
    }
  }
}
