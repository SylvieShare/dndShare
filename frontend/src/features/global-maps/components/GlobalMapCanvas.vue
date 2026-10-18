<template>
  <div ref="host" class="global-map-canvas" :class="{ 'global-map-canvas--adding': addMode && !readonly }"
    tabindex="0" aria-label="Мир. Колесо — масштаб, перетаскивание — перемещение, точки можно перетаскивать."
    @pointerdown="down" @pointermove="movePointer" @pointerenter="continuation.track" @pointerleave="continuation.leave" @contextmenu.prevent @pointerup="v.end($event)" @pointercancel="v.end($event, true)"
    @lostpointercapture="v.end($event, true)" @wheel.prevent="hidePreview(); v.zoom(Math.exp(-$event.deltaY * .001), $event)" @keydown.stop="key">
    <div class="global-map-world" :style="v.style">
      <img :key="imageGeneration" class="global-map-image" :src="imageUrl" alt="Карта мира" draggable="false" @load="v.load" @error="v.imageError = true" />
      <GlobalMapPaths :routes="routes" :width="v.image.width" :height="v.image.height" :unit="routeUnit" :selected-route="selectedRoute" :preview="continuation.preview.value" :readonly="readonly" />
      <div v-for="marker in markers" :key="marker.sourceId" v-memo="[marker, v.view.scale, preview?.id, selectedPoint]" class="global-map-anchor"
        :class="{ 'global-map-anchor--control': marker.control }" :style="anchor(marker, marker.color)">
        <button type="button" :class="[marker.control ? 'global-map-control' : 'global-map-point', { 'global-map-point--selected': marker.id === selectedPoint }]"
          :data-point-id="marker.id" :data-route-id="marker.routeId" :data-source-id="marker.sourceId" :data-control="marker.control || undefined"
          :aria-label="marker.control ? `Узел изгиба: ${marker.routeName}` : `${marker.routeName}, точка ${marker.numbers.join(', ')}${marker.name ? ': ' + marker.name : ''}`"
          :aria-pressed="marker.id === selectedPoint" :aria-haspopup="marker.control ? undefined : 'dialog'" :aria-expanded="preview?.id === marker.id"
          @pointerenter="showPreview($event, marker.routeId, marker)" @pointerleave="queueClose" @focus="showPreview($event, marker.routeId, marker)"
          @blur="queueClose" @click.stop="clickMarker($event, marker)" @keydown.stop="pointKey($event, marker.routeId, marker)">
          <template v-if="!marker.control">{{ marker.numbers.length <= 2 ? marker.numbers.join('·') : `${marker.number}↻` }}</template>
        </button>
        <span v-if="marker.last" class="global-map-endpoint" role="img" aria-label="Последняя точка маршрута" title="Последняя точка · Cmd/Ctrl — продолжить маршрут"><FlagTriangleRight :size="13" /></span>
      </div>
      <div v-if="continuation.preview.value" class="global-map-anchor global-map-ghost" :style="anchor(continuation.preview.value, continuation.preview.value.color)">
        <span class="global-map-point">{{ continuation.preview.value.sourceId ? '↻' : '+' }}</span>
      </div>
      <template v-for="route in routes" :key="route.id">
        <div v-if="route.points.length && route.playerIds.length" class="global-map-party" :style="partyStyle(route)">
          <span class="global-map-route-name">{{ route.name }}</span>
          <span class="global-map-party-avatars">
            <span v-for="player in routePlayers(route)" :key="player.charId" class="global-map-avatar" role="img" :aria-label="pvName(player) || 'Игрок'" :title="pvName(player) || 'Игрок'">
              <img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" draggable="false" />
              <UserRound v-else :size="20" />
            </span>
          </span>
        </div>
      </template>
    </div>
    <BasePopover :open="!!previewData" :anchor="preview?.anchor" :placement="mobile ? 'bottom-start' : 'right-start'" :min-width="220" role="dialog" aria-label="Превью точки маршрута"
      transition-preset="action-menu" @update:open="!$event && hidePreview()">
      <GlobalMapCallout v-if="previewData" :point="previewData.point" :chapter="previewData.chapter" :route-name="previewData.routeName" :index="previewData.index" @chapter="showChapter"
        @pointerenter="keepPreview" @pointerleave="queueClose" @focusin="keepPreview" @focusout="queueClose" />
    </BasePopover>
    <LoadingState v-if="!v.loaded && !v.imageError" class="global-map-message" label="Загружаем изображение…" />
    <div v-if="v.imageError" class="global-map-message" role="alert">Не удалось открыть изображение карты.
      <ActionButton variant="secondary" @pointerdown.stop @click="v.imageError = false; v.loaded = false; imageGeneration++">Повторить загрузку изображения</ActionButton>
    </div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { FlagTriangleRight, UserRound } from '@lucide/vue'
import { ActionButton, BasePopover, LoadingState, useIsMobile } from '@sylvieshare/share-ui'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import { clamp } from '../lib/routes'
import { useGlobalMapViewport } from '../composables/useGlobalMapViewport'
import GlobalMapCallout from './GlobalMapCallout.vue'
import GlobalMapPaths from './GlobalMapPaths.vue'
import { mapMarkers, routePoints, waypointEntries } from '../lib/routePoints'
import { useGlobalMapContinuation } from '../composables/useGlobalMapContinuation'
const props = defineProps({ imageUrl: String, routes: Array, chapters: Array, participants: Array, selectedRoute: String, selectedPoint: String, addMode: Boolean, readonly: Boolean })
const emit = defineEmits(['select', 'add', 'move', 'drag-start', 'drag-end', 'remove-point', 'chapter', 'cancel-add', 'insert-control', 'cancel-control', 'continuation-active'])
const mobile = useIsMobile(760)
const host = ref(null)
const imageGeneration = ref(0)
const v = reactive(useGlobalMapViewport(host, props, emit))
const continuation = useGlobalMapContinuation(host, props, v, emit)
watch(continuation.engaged, active => { emit('continuation-active', active); if (active) hidePreview() })
const markers = computed(() => mapMarkers(props.routes, props.selectedRoute, props.selectedPoint))
const baseUnit = computed(() => Math.max(v.image.width, v.image.height) / 1200)
const drawingScale = computed(() => Math.min(2.2, .4 + baseUnit.value * v.view.scale))
const routeUnit = computed(() => .8 * drawingScale.value / v.view.scale)
const anchor = (p, color) => ({ left: `${p.x * v.image.width}px`, top: `${p.y * v.image.height}px`, '--route-color': color, transform: `scale(${.8 * Math.max(1, drawingScale.value) / v.view.scale}) translate(-50%, -50%)` })
const routePlayers = route => props.participants.filter(player => route.playerIds.includes(player.charId))
const preview = shallowRef(null)
const previewData = computed(() => {
  const route = props.routes.find(route => route.id === preview.value?.routeId)
  const point = route && routePoints(route, props.routes).find(point => point.id === preview.value?.id)
  return point && !point.control ? { point, chapter: props.chapters.find(chapter => chapter.id === point.chapterId), routeName: route.name, index: waypointEntries(route).findIndex(entry => entry.id === point.id) } : null
})
let closeTimer
function keepPreview() { clearTimeout(closeTimer) }
function hidePreview() { keepPreview(); preview.value = null }
function showPreview(event, routeId, point) {
  if (event.pointerType === 'touch' || props.addMode || point.control || continuation.preview.value) return
  keepPreview(); preview.value = { id: point.id, routeId, anchor: event.currentTarget }
}
function queueClose() { keepPreview(); closeTimer = setTimeout(hidePreview, 160) }
watch(() => [v.view.x, v.view.y, v.view.scale, props.imageUrl], hidePreview)
let visibility
onMounted(() => {
  visibility = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) { hidePreview(); continuation.leave() } })
  visibility.observe(host.value)
})
onBeforeUnmount(() => { keepPreview(); visibility?.disconnect(); emit('continuation-active', false) })
function showChapter(chapter) { hidePreview(); emit('chapter', chapter) }
function partyStyle(route) {
  const p = routePoints(route, props.routes).at(-1)
  return { ...anchor(p, route.color), transform: `scale(${1 / v.view.scale}) translate(28px, 28px)` }
}
function key(event) {
  if (event.target.closest('[data-map-callout], button:not([data-point-id])')) return
  const route = props.routes.find(route => route.points.some(point => point.id === props.selectedPoint))
  const point = route && routePoints(route, props.routes).find(point => point.id === props.selectedPoint)
  if (point) pointKey(event, route.id, point)
  if (event.key === 'Escape') { v.cancelDrag(); continuation.cancel(); hidePreview(); emit('select', props.selectedRoute, ''); emit('cancel-add') }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); v.zoom(1.2) }
  if (event.key === '-') { event.preventDefault(); v.zoom(1 / 1.2) }
}
function down(event) {
  hidePreview()
  if (event.metaKey || event.ctrlKey) host.value.focus({ preventScroll: true })
  if (!continuation.commit(event)) v.down(event)
}
function movePointer(event) { continuation.track(event); v.move(event) }
function clickMarker(event, marker) {
  if (event.metaKey || event.ctrlKey || props.addMode) return
  emit('select', marker.routeId, marker.id)
}
function pointKey(event, routeId, point) {
  if (event.key === 'Escape') { v.cancelDrag(); continuation.cancel(); hidePreview(); emit('select', routeId, ''); emit('cancel-add'); return }
  if (props.readonly) return
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); emit('remove-point', routeId, point.id) }
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!delta) return
  event.preventDefault()
  emit('drag-start')
  const step = event.shiftKey ? 20 : 5
  emit('move', routeId, point.id, { x: clamp(point.x + delta[0] * step / (v.image.width * v.view.scale)), y: clamp(point.y + delta[1] * step / (v.image.height * v.view.scale)) })
  emit('drag-end', true)
}
defineExpose({ fit: v.fit, zoom: v.zoom, focusPoint: v.focusPoint })
</script>
<style scoped src="../styles/globalMapCanvas.css"></style>
