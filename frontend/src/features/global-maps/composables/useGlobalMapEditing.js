import { computed, ref, watch } from 'vue'
import { reorderVisits, ROUTE_COLORS, uid } from '../lib/routes'
import { appendVisit, lastWaypoint, pointIndex, removeEntries, resolvePoint, routeVisits } from '../lib/routePoints'

export function useGlobalMapEditing(c, canvas, sidebar, mobile, props) {
  const routeId = ref(''), pointId = ref(''), addMode = ref(false), routeFocus = ref(false)
  const route = computed(() => c.selected?.routes.find(route => route.id === routeId.value))
  const entry = computed(() => route.value?.points.find(point => point.id === pointId.value))
  const definition = computed(() => resolvePoint(entry.value, pointIndex(c.selected?.routes || [])))
  const inspectorRoute = computed(() => route.value && ({ ...route.value, points: routeVisits(route.value, c.selected.routes) }))
  const point = computed(() => definition.value && !definition.value.control ? { ...definition.value, id: entry.value.id, visitCount: c.selected.routes.flatMap(route => route.points).filter(point => (point.refId || point.id) === definition.value.id).length } : null)
  const index = computed(() => inspectorRoute.value?.points.findIndex(point => point.id === pointId.value) ?? -1)
  watch(() => c.selectedId, () => { routeId.value = c.selected?.routes[0]?.id || ''; pointId.value = ''; addMode.value = false; routeFocus.value = false })
  function room() {
    if (!c.selected || c.conflict || c.busy) return false
    if (c.selected.routes.reduce((sum, route) => sum + route.points.length, 0) < 1000) return true
    c.error = 'На карте допускается до 1000 точек, посещений и узлов изгиба'
    return false
  }
  function select(id, point) { routeId.value = id; pointId.value = point; addMode.value = false; routeFocus.value = false }
  function selectRoute(id) { select(id, ''); routeFocus.value = true; if (mobile.value) sidebar.value?.collapse() }
  function selectPoint(id) {
    select(routeId.value, id)
    if (definition.value) canvas.value?.focusPoint(definition.value)
    if (mobile.value) sidebar.value?.collapse()
  }
  function startAdding() { if (!route.value) return; addMode.value = true; pointId.value = ''; routeFocus.value = false; if (mobile.value) sidebar.value?.collapse() }
  function addRoute() {
    const id = uid(), count = c.selected.routes.length
    c.change(map => map.routes.push({ id, name: `Маршрут ${count + 1}`, color: ROUTE_COLORS[count % ROUTE_COLORS.length], playerIds: [], points: [] }))
    selectRoute(id)
  }
  function addPoint(position, sourceId) {
    if (!route.value || !room()) return
    if (sourceId && (lastWaypoint(route.value)?.refId || lastWaypoint(route.value)?.id) === sourceId) return
    let added
    c.change(() => {
      if (sourceId) {
        const source = pointIndex(c.selected.routes).get(sourceId)
        if (source && !source.control) added = appendVisit(route.value, source)
      } else {
        added = { id: uid(), ...position, name: '', note: '', chapterId: props.chapters.some(chapter => chapter.id === props.currentChapterId) ? props.currentChapterId : null, additionalChapterIds: [], locationIds: [] }
        route.value.points.push(added)
      }
    })
    if (added) { pointId.value = added.id; routeFocus.value = false }
  }
  function move(id, entryId, position) {
    const entry = c.selected?.routes.find(route => route.id === id)?.points.find(point => point.id === entryId)
    const point = resolvePoint(entry, pointIndex(c.selected?.routes || []))
    if (point) Object.assign(point, position)
  }
  function insertControl(id, index, point) {
    const target = c.selected?.routes.find(route => route.id === id)
    if (!room() || !target?.points[index + 1]) return
    c.editing = true
    target.points.splice(index + 1, 0, point)
    select(id, point.id)
  }
  function cancelControl(id, controlId) {
    const target = c.selected?.routes.find(route => route.id === id)
    if (target) target.points = target.points.filter(point => point.id !== controlId)
    if (controlId === pointId.value) pointId.value = ''
  }
  function endDrag(changed) { c.editing = false; if (changed) c.persist() }
  function patchPoint(patch) { if (definition.value) c.change(() => Object.assign(definition.value, patch)) }
  function reorder(ids) { c.change(() => reorderVisits(route.value, ids)) }
  function deletePoint(id, entryId) {
    c.change(map => removeEntries(map.routes, (route, point) => route.id === id && point.id === entryId))
    pointId.value = ''
  }
  function deleteRoute(id) {
    c.change(map => {
      removeEntries(map.routes, route => route.id === id)
      map.routes = map.routes.filter(route => route.id !== id)
    })
    if (routeId.value === id) { routeId.value = c.selected.routes[0]?.id || ''; pointId.value = ''; addMode.value = false; routeFocus.value = false }
  }
  return { routeId, pointId, addMode, routeFocus, route, definition, point, inspectorRoute, index, select, selectRoute, selectPoint, startAdding, addRoute, addPoint, move,
    insertControl, cancelControl, endDrag, patchPoint, reorder, deletePoint, deleteRoute }
}
