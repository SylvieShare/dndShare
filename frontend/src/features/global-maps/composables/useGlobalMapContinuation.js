import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { lastWaypoint, pointIndex, resolvePoint } from '../lib/routePoints'
import { routeSegments } from '../lib/routes'

export function useGlobalMapContinuation(host, props, viewport, emit) {
  const cursor = ref(null), modifier = ref(false), cancelled = ref(false)
  const route = computed(() => props.routes.find(route => route.id === props.selectedRoute))
  const end = computed(() => resolvePoint(lastWaypoint(route.value), pointIndex(props.routes)))
  const target = computed(() => {
    if (!modifier.value || cancelled.value || props.readonly || !cursor.value || !end.value || !viewport.loaded) return null
    if (cursor.value.sourceId === end.value.id || Math.hypot(cursor.value.x - end.value.x, cursor.value.y - end.value.y) < 1e-8) return null
    return cursor.value
  })
  const engaged = computed(() => modifier.value && !cancelled.value && !props.readonly && !!cursor.value && !!end.value)
  const preview = computed(() => {
    if (!target.value) return null
    const points = [end.value, target.value]
    return { ...target.value, color: route.value.color, path: routeSegments(points, viewport.image.width, viewport.image.height).at(-1)?.path || '' }
  })
  function track(event) {
    modifier.value = event.metaKey || event.ctrlKey
    const position = viewport.point(event, false)
    if (position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) { cursor.value = null; return }
    const marker = event.target.closest('[data-source-id]:not([data-control])')
    const source = marker && pointIndex(props.routes).get(marker.dataset.sourceId)
    cursor.value = source ? { x: source.x, y: source.y, sourceId: source.id } : position
  }
  function commit(event) {
    if (!(event.metaKey || event.ctrlKey) || event.button !== 0 || props.readonly) return false
    track(event)
    event.preventDefault()
    if (target.value) emit('add', { x: target.value.x, y: target.value.y }, target.value.sourceId)
    return true
  }
  function cancel() { cancelled.value = true; cursor.value = null }
  function leave() { cursor.value = null }
  function keydown(event) {
    if (!host.value?.getClientRects().length || event.target.closest('input,textarea,select,[contenteditable="true"]')) return
    if (event.key === 'Meta' || event.key === 'Control') {
      if (!event.repeat) cancelled.value = false
      modifier.value = true
    }
    if (event.key === 'Escape' && target.value) { event.preventDefault(); cancel() }
  }
  function keyup(event) { modifier.value = event.metaKey || event.ctrlKey; if (!modifier.value) cancelled.value = false }
  function blur() { modifier.value = false; leave(); viewport.cancelDrag() }
  onMounted(() => { window.addEventListener('keydown', keydown, true); window.addEventListener('keyup', keyup, true); window.addEventListener('blur', blur) })
  onBeforeUnmount(() => { window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup, true); window.removeEventListener('blur', blur) })
  return { preview, engaged, track, commit, cancel, leave }
}
