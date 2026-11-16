import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { clamp, uid } from '../lib/routes'
import { pointIndex, resolvePoint, routeLegKey } from '../lib/routePoints'
import { useCanvasPinch } from '@/shared/composables/useCanvasPinch'

export function useGlobalMapViewport(host, props, emit) {
  const image = reactive({ width: 1200, height: 800 }), view = reactive({ x: 0, y: 0, scale: 1 })
  const loaded = ref(false), imageError = ref(false), dragging = ref(false)
  let observer, drag = null, holdTimer, initialized = false, lastWidth = 0, lastHeight = 0
  const style = computed(() => ({ width: `${image.width}px`, height: `${image.height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }))
  function fit() {
    if (!host.value) return
    const bounds = host.value.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    view.scale = Math.min((bounds.width - 64) / image.width, (bounds.height - 64) / image.height, 2)
    view.scale = Math.max(.01, view.scale)
    view.x = (bounds.width - image.width * view.scale) / 2
    view.y = (bounds.height - image.height * view.scale) / 2
    lastWidth = bounds.width; lastHeight = bounds.height
    initialized = true
  }
  function load(event) {
    image.width = event.target.naturalWidth
    image.height = event.target.naturalHeight
    loaded.value = true; imageError.value = false; fit()
  }
  function point(event, bounded = true) {
    const rect = host.value.getBoundingClientRect()
    const p = { x: (event.clientX - rect.x - view.x) / (image.width * view.scale), y: (event.clientY - rect.y - view.y) / (image.height * view.scale) }
    return bounded ? { x: clamp(p.x), y: clamp(p.y) } : p
  }
  function zoom(factor, event) {
    const rect = host.value.getBoundingClientRect()
    const x = event ? event.clientX - rect.x : rect.width / 2, y = event ? event.clientY - rect.y : rect.height / 2
    const scale = clamp(view.scale * factor, .01, 8), ratio = scale / view.scale
    view.x = x - (x - view.x) * ratio; view.y = y - (y - view.y) * ratio; view.scale = scale
  }
  useCanvasPinch(host, { enabled: () => loaded.value, onStart: cancelDrag,
    onChange: ({ factor, center, previousCenter }) => {
      zoom(factor, previousCenter)
      view.x += center.clientX - previousCenter.clientX; view.y += center.clientY - previousCenter.clientY
    } })
  function down(event) {
    if (drag || !loaded.value || ![0, 1].includes(event.button) || event.target.closest('[data-map-callout]')) return
    host.value.focus({ preventScroll: true })
    const marker = !event.altKey && event.button === 0 && event.target.closest('[data-point-id]')
    const id = marker?.dataset.pointId
    const route = props.routes.find(route => route.id === marker?.dataset.routeId) || props.routes.find(route => route.points.some(point => point.id === id))
    const entry = route?.points.find(point => point.id === id)
    const selected = resolvePoint(entry, pointIndex(props.routes))
    if (selected && props.addMode && !selected.control && !props.readonly) {
      if (event.pointerType === 'touch') {
        drag = { pointerId: event.pointerId, addPoint: { x: selected.x, y: selected.y }, sourceId: selected.id,
          x: event.clientX, y: event.clientY, moved: false }
        host.value.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }
      emit('add', { x: selected.x, y: selected.y }, selected.id)
      event.preventDefault()
      return
    }
    const segment = !id && !props.addMode && !props.readonly && !event.altKey && event.button === 0 ? event.target.closest('[data-segment-index]') : null
    if (selected) emit('select', route.id, id)
    drag = { pointerId: event.pointerId, id, routeId: route?.id || segment?.dataset.routeId,
      segment: segment ? Number(segment.dataset.segmentIndex) : null, created: false, deselect: !id && !segment && !event.altKey && event.button === 0 && !props.addMode,
      before: selected && { x: selected.x, y: selected.y }, x: event.clientX, y: event.clientY,
      viewX: view.x, viewY: view.y, moved: false, pan: !id && !segment && (!props.addMode || event.altKey || event.button === 1) }
    dragging.value = true
    host.value.setPointerCapture(event.pointerId)
    if (segment) {
      const legKey = segment.dataset.legKey
      emit('select-leg', drag.routeId, drag.segment, segment)
      holdTimer = setTimeout(() => {
        if (!drag || drag.moved || props.readonly || props.addMode) return
        if (segment.dataset.legKey !== legKey || routeLegKey(props.routes.find(route => route.id === drag.routeId), drag.segment) !== legKey) return
        drag.menu = true
        emit('leg-menu', drag.routeId, drag.segment, segment, { detail: 1, clientX: event.clientX, clientY: event.clientY })
      }, 500)
    }
    if (id && !props.readonly) emit('drag-start')
    event.preventDefault()
  }
  function move(event) {
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4
    if (drag.moved) clearTimeout(holdTimer)
    if (drag.menu) return
    if (drag.addPoint) return
    if (drag.segment !== null && drag.moved && !props.readonly && !drag.created) {
      drag.id = uid(); drag.created = true
      emit('drag-start')
      emit('insert-control', drag.routeId, drag.segment, { id: drag.id, ...point(event), control: true, name: '', note: '', chapterId: null })
    }
    if (drag.id && !props.readonly && drag.moved) emit('move', drag.routeId, drag.id, point(event))
    else if (drag.pan) { view.x = drag.viewX + event.clientX - drag.x; view.y = drag.viewY + event.clientY - drag.y }
  }
  function end(event, cancel = false) {
    if (!drag || drag.pointerId !== event.pointerId) return
    clearTimeout(holdTimer)
    if (drag.addPoint) {
      if (!cancel && !drag.moved) emit('add', drag.addPoint, drag.sourceId)
    } else if (drag.id && !props.readonly) {
      if (cancel && drag.created) emit('cancel-control', drag.routeId, drag.id)
      else if (cancel) emit('move', drag.routeId, drag.id, drag.before)
      emit('drag-end', !cancel && drag.moved)
    } else if (!cancel && !drag.moved && !drag.pan && drag.segment === null && !props.readonly) {
      const p = point(event, false)
      if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) emit('add', p)
    }
    if (!cancel && !drag.moved && drag.deselect) emit('select', props.selectedRoute, '')
    const id = drag.pointerId
    drag = null
    dragging.value = false
    if (host.value.hasPointerCapture(id)) host.value.releasePointerCapture(id)
  }
  function cancelDrag() { if (drag) end({ pointerId: drag.pointerId }, true); emit('cancel-leg-menu') }
  function focusPoint(p) {
    const rect = host.value.getBoundingClientRect()
    view.x = rect.width / 2 - p.x * image.width * view.scale
    view.y = rect.height / 2 - p.y * image.height * view.scale
  }
  watch(() => props.imageUrl, () => { loaded.value = false; imageError.value = false; initialized = false })
  onMounted(() => {
    observer = new ResizeObserver(() => {
      const rect = host.value.getBoundingClientRect()
      if (!rect.width || !rect.height || drag) return
      if (!initialized) fit()
      else { view.x += (rect.width - lastWidth) / 2; view.y += (rect.height - lastHeight) / 2; lastWidth = rect.width; lastHeight = rect.height }
    })
    observer.observe(host.value)
  })
  onBeforeUnmount(() => { cancelDrag(); observer?.disconnect() })
  return { image, view, style, loaded, imageError, dragging, fit, load, point, zoom, down, move, end, cancelDrag, focusPoint }
}
