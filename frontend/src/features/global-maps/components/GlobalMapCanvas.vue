<template>
  <div ref="host" class="global-map-canvas" :class="{ 'global-map-canvas--adding': addMode && !readonly }"
    tabindex="0" aria-label="Мир. Колесо — масштаб, перетаскивание — перемещение, точки можно перетаскивать."
    @pointerdown="down" @pointermove="movePointer" @pointerenter="isMousePointer($event) && continuation.track($event)" @pointerleave="leavePointer" @contextmenu.prevent="lineContextMenu" @pointerup="endPointer" @pointercancel="v.end($event, true)"
    @lostpointercapture="v.end($event, true)" @wheel.prevent="hidePreview(); v.cancelDrag(); v.zoom(Math.exp(-$event.deltaY * .001), $event)" @keydown="key">
    <div class="global-map-world" :style="v.style">
      <img :key="imageGeneration" class="global-map-image" :src="imageUrl" alt="Карта мира" draggable="false" @load="v.load" @error="v.imageError = true" />
      <GlobalMapPaths :routes="routes" :width="v.image.width" :height="v.image.height" :unit="routeUnit" :selected-route="selectedRoute" :selected-leg="selectedLeg" :preview="continuation.preview.value" :readonly="readonly" />
      <GlobalMapMarker v-for="marker in markers" :key="marker.sourceId" v-memo="[marker, v.image.width, v.image.height, v.view.scale, preview?.id, selectedPoint, hoveredLeg, selectedLeg]"
        :marker="marker" :selected="marker.id === selectedPoint" :expanded="preview?.id === marker.id" :hidden="marker.control && !controlVisible(marker)" :style="anchor(marker, marker.color)"
        @enter="showPreview($event, marker.routeId, marker)" @leave="queueClose" @focus="showPreview($event, marker.routeId, marker)" @blur="queueClose"
        @activate="clickMarker($event, marker)" @key="pointKey($event, marker.routeId, marker)" />
      <GlobalMapMarker v-if="continuation.preview.value" class="global-map-ghost" :interactive="false"
        :marker="{ ...continuation.preview.value, numbers: [continuation.preview.value.sourceId ? '↻' : '+'] }" :style="anchor(continuation.preview.value, continuation.preview.value.color)" />
      <template v-for="route in routes" :key="route.id">
        <div v-if="route.points.length && route.playerIds.length" class="global-map-party" :style="partyStyle(route)">
          <span class="global-map-route-name">{{ route.name }}</span>
          <span class="global-map-party-avatars">
            <span v-for="player in routePlayers(route)" :key="player.charId" class="global-map-avatar" role="img" :aria-label="pvName(player) || 'Игрок'" :title="pvName(player) || 'Игрок'">
              <CharacterAvatar :src="pvAvatar(player)" :name="pvName(player)" size="100%" />
            </span>
          </span>
        </div>
      </template>
    </div>
    <RowActionMenu ref="legMenu" :anchor="legAnchor" title="Линия маршрута" :disabled="readonly || addMode" :trigger-attrs="{ style: { display: 'none' } }">
      <template #default="{ close }"><RowActionItem action="delete" tone="danger" :disabled="!legControls.length" @click="clearLegControls(); close()">Удалить промежуточные точки</RowActionItem></template>
    </RowActionMenu>
    <BasePopover :open="!!previewData" :anchor="preview?.anchor" :placement="mobile ? 'bottom-start' : 'right-start'" :min-width="220" role="dialog" aria-label="Превью точки маршрута"
      transition-preset="action-menu" @update:open="!$event && hidePreview()">
      <GlobalMapCallout v-if="previewData" :point="previewData.point" :chapters="previewData.chapters" :locations="previewData.locations" :route-name="previewData.routeName" :index="previewData.index" @chapter="showChapter" @location="showLocation"
        @pointerenter="keepPreview" @pointerleave="queueClose" @focusin="keepPreview" @focusout="queueClose" />
    </BasePopover>
    <LoadingState v-if="!v.loaded && !v.imageError" class="global-map-message" label="Загружаем изображение…" />
    <div v-if="v.imageError" class="global-map-message" role="alert">Не удалось открыть изображение карты.
      <ActionButton variant="secondary" @pointerdown.stop @click="v.imageError = false; v.loaded = false; imageGeneration++">Повторить загрузку изображения</ActionButton>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import { ActionButton, BasePopover, LoadingState, RowActionMenu, canShowHoverHint, isMousePointer, useIsMobile } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import GlobalMapMarker from './GlobalMapMarker.vue'
import { mapDrawingUnits, mapPointAnchor } from '../lib/mapDrawing'
import { clamp } from '../lib/routes'
import { useGlobalMapViewport } from '../composables/useGlobalMapViewport'
import GlobalMapCallout from './GlobalMapCallout.vue'
import GlobalMapPaths from './GlobalMapPaths.vue'
import { mapMarkers, routeLegControls, routeLegKey, routePoints, waypointEntries } from '../lib/routePoints'
import { linkedItems, pointChapterIds } from '../lib/pointLinks'
import { useGlobalMapContinuation } from '../composables/useGlobalMapContinuation'
const props = defineProps({ imageUrl: String, routes: Array, chapters: Array, locations: Array, participants: Array, selectedRoute: String, selectedPoint: String, addMode: Boolean, readonly: Boolean })
const emit = defineEmits(['select', 'add', 'move', 'drag-start', 'drag-end', 'remove-point', 'chapter', 'location', 'cancel-add', 'insert-control', 'cancel-control', 'continuation-active', 'clear-leg-controls'])
const mobile = useIsMobile(760)
const host = ref(null)
const imageGeneration = ref(0)
const v = reactive(useGlobalMapViewport(host, props, viewportEvent))
const continuation = useGlobalMapContinuation(host, props, v, emit)
watch(continuation.engaged, active => { emit('continuation-active', active); if (active) hidePreview() })
const markers = computed(() => mapMarkers(props.routes, props.selectedRoute, props.selectedPoint))
const drawing = computed(() => mapDrawingUnits(v.image, v.view.scale))
const routeUnit = computed(() => drawing.value.route)
const anchor = (point, color) => mapPointAnchor(point, v.image, drawing.value.marker, color)
const viewport = computed(() => ({ width: v.image.width, height: v.image.height, scale: v.view.scale, loaded: v.loaded, error: v.imageError }))
const legSelection = ref(null), legMenu = ref(null), legAnchor = shallowRef(null)
const selectedLeg = computed(() => legSelection.value?.key || '')
const selectedLegRoute = computed(() => props.routes.find(route => route.id === legSelection.value?.routeId))
const legControls = computed(() => routeLegControls(selectedLegRoute.value, selectedLeg.value))
const legExists = computed(() => selectedLegRoute.value?.points.some((point, index) => !point.control && routeLegKey(selectedLegRoute.value, index) === selectedLeg.value))
function clearLegSelection() { legSelection.value = null; legAnchor.value = null; legMenu.value?.close() }
function selectLeg(id, position, node) {
  const route = props.routes.find(route => route.id === id), key = routeLegKey(route, position)
  if (!key || props.readonly || props.addMode) return
  legMenu.value?.close(); hidePreview()
  legSelection.value = { routeId: id, key }; legAnchor.value = node
  emit('select', id, '')
  return key
}
async function openLegMenu(id, position, node, event) {
  const key = selectLeg(id, position, node)
  if (!key) return
  await nextTick()
  if (key && selectedLeg.value === key && !props.readonly && !props.addMode) legMenu.value?.open(event)
}
function viewportEvent(event, ...args) {
  if (event === 'select-leg') selectLeg(...args)
  else if (event === 'leg-menu') openLegMenu(...args)
  else if (event === 'cancel-leg-menu') legMenu.value?.close()
  else emit(event, ...args)
}
function clearLegControls() { if (legSelection.value && !props.readonly) emit('clear-leg-controls', legSelection.value.routeId, selectedLeg.value) }
function lineContextMenu(event) {
  const hit = event.target.closest('[data-segment-index]')
  if (hit) openLegMenu(hit.dataset.routeId, Number(hit.dataset.segmentIndex), hit, { detail: 1, clientX: event.clientX, clientY: event.clientY })
}
watch(legExists, exists => { if (!exists) clearLegSelection() })
watch(() => [props.selectedPoint, props.selectedRoute, props.addMode, props.readonly], ([point, route, add, readonly]) => {
  if (point || add || readonly || legSelection.value?.routeId !== route) clearLegSelection()
})
const routePlayers = route => props.participants.filter(player => route.playerIds.includes(player.charId))
const preview = shallowRef(null)
const previewData = computed(() => {
  const route = props.routes.find(route => route.id === preview.value?.routeId)
  const point = route && routePoints(route, props.routes).find(point => point.id === preview.value?.id)
  return point && !point.control ? { point, chapters: linkedItems(props.chapters, pointChapterIds(point)), locations: linkedItems(props.locations, point.locationIds || []), routeName: route.name, index: waypointEntries(route).findIndex(entry => entry.id === point.id) } : null
})
let closeTimer
function keepPreview() { clearTimeout(closeTimer) }
function hidePreview() { keepPreview(); preview.value = null }
function showPreview(event, routeId, point) {
  if (!canShowHoverHint(event) || props.addMode || point.control || continuation.preview.value) return
  keepPreview(); preview.value = { id: point.id, routeId, anchor: event.currentTarget }
}
function queueClose() { keepPreview(); closeTimer = setTimeout(hidePreview, 160) }
watch(() => [v.view.x, v.view.y, v.view.scale, props.imageUrl], () => { hidePreview(); if (!v.dragging) hoveredLeg.value = '' })
let visibility
onMounted(() => {
  visibility = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) { hidePreview(); continuation.leave(); hoveredLeg.value = '' } })
  visibility.observe(host.value)
})
onBeforeUnmount(() => { keepPreview(); visibility?.disconnect(); emit('continuation-active', false) })
function showChapter(chapter) { hidePreview(); emit('chapter', chapter) }
function showLocation(location) { hidePreview(); emit('location', location) }
function partyStyle(route) {
  const p = routePoints(route, props.routes).at(-1)
  return { ...anchor(p, route.color), transform: `scale(${1 / v.view.scale}) translate(28px, 28px)` }
}
function key(event) {
  if (event.target.closest('[data-map-callout], button:not([data-point-id])')) return
  const hit = event.target.closest('[data-segment-index]') || (event.target === host.value ? [...host.value.querySelectorAll('[data-segment-index]')].find(node => node.dataset.legKey === selectedLeg.value) : null)
  if (hit && ['Enter', ' ', 'ContextMenu', 'F10'].includes(event.key) && (event.key !== 'F10' || event.shiftKey)) {
    event.preventDefault(); event.stopPropagation()
    const args = [hit.dataset.routeId, Number(hit.dataset.segmentIndex), hit]
    if (event.key === 'Enter' || event.key === ' ') selectLeg(...args)
    else openLegMenu(...args, event)
    return
  }
  const route = props.routes.find(route => route.points.some(point => point.id === props.selectedPoint))
  const point = route && routePoints(route, props.routes).find(point => point.id === props.selectedPoint)
  if (point) pointKey(event, route.id, point)
  if (event.key === 'Escape') { event.stopPropagation(); v.cancelDrag(); continuation.cancel(); hidePreview(); clearLegSelection(); emit('select', props.selectedRoute, ''); emit('cancel-add') }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); event.stopPropagation(); v.zoom(1.2) }
  if (event.key === '-') { event.preventDefault(); event.stopPropagation(); v.zoom(1 / 1.2) }
}
function down(event) {
  hidePreview()
  if (isMousePointer(event)) hoverLeg(event.target)
  else hoveredLeg.value = ''
  if (!event.target.closest('[data-segment-index], [data-control]')) clearLegSelection()
  if (event.metaKey || event.ctrlKey) host.value.focus({ preventScroll: true })
  if (!continuation.commit(event)) v.down(event)
}
const hoveredLeg = ref('')
function controlVisible(marker) {
  const key = routeLegKey(props.routes.find(route => route.id === marker.routeId), marker.position)
  return !!key && (hoveredLeg.value === key || selectedLeg.value === key)
}
function hoverLeg(target) {
  const hit = target?.closest?.('[data-segment-index], [data-control]')
  const route = props.routes.find(route => route.id === hit?.dataset.routeId)
  hoveredLeg.value = hit ? routeLegKey(route, Number(hit.dataset.segmentIndex ?? hit.dataset.position)) : ''
}
function movePointer(event) {
  if (isMousePointer(event)) {
    if (!v.dragging) hoverLeg(event.target)
    continuation.track(event)
  }
  v.move(event)
}
function endPointer(event) {
  v.end(event)
  if (isMousePointer(event)) hoverLeg(document.elementFromPoint(event.clientX, event.clientY))
  else hoveredLeg.value = ''
}
function leavePointer() { continuation.leave(); if (!v.dragging) hoveredLeg.value = '' }
function clickMarker(event, marker) {
  if (event.metaKey || event.ctrlKey || props.addMode) return
  emit('select', marker.routeId, marker.id)
}
function pointKey(event, routeId, point) {
  if (event.key === 'Escape') { event.stopPropagation(); v.cancelDrag(); continuation.cancel(); hidePreview(); emit('select', routeId, ''); emit('cancel-add'); return }
  if (props.readonly) return
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); emit('remove-point', routeId, point.id) }
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!delta) return
  event.preventDefault(); event.stopPropagation()
  emit('drag-start')
  const step = event.shiftKey ? 20 : 5
  emit('move', routeId, point.id, { x: clamp(point.x + delta[0] * step / (v.image.width * v.view.scale)), y: clamp(point.y + delta[1] * step / (v.image.height * v.view.scale)) })
  emit('drag-end', true)
}
defineExpose({ viewport, fit: v.fit, zoom: v.zoom, focusPoint: v.focusPoint })
</script>
<style scoped src="../styles/globalMapCanvas.css"></style>
