<template>
  <div ref="host" class="global-map-canvas" :class="{ 'global-map-canvas--adding': addMode && !readonly }"
    tabindex="0" aria-label="Мир. Колесо — масштаб, перетаскивание — перемещение, точки можно перетаскивать."
    @pointerdown="hidePreview(); v.down($event)" @pointermove="v.move" @pointerup="v.end($event)" @pointercancel="v.end($event, true)"
    @lostpointercapture="v.end($event, true)" @wheel.prevent="hidePreview(); v.zoom(Math.exp(-$event.deltaY * .001), $event)" @keydown.stop="key">
    <div class="global-map-world" :style="v.style">
      <img :key="imageGeneration" class="global-map-image" :src="imageUrl" alt="Карта мира" draggable="false" @load="v.load" @error="v.imageError = true" />
      <svg class="global-map-paths" :viewBox="`0 0 ${v.image.width} ${v.image.height}`" aria-hidden="true">
        <g v-for="route in routes" :key="route.id" :opacity="!selectedRoute || route.id === selectedRoute ? 1 : .75"
          fill="none" stroke-linecap="round" :stroke-dasharray="`${8 * routeUnit} ${12 * routeUnit}`">
          <path class="global-map-route-outline" :d="routePath(route.points, v.image.width, v.image.height)" :stroke-width="8 * routeUnit" />
          <path class="global-map-route-line" :d="routePath(route.points, v.image.width, v.image.height)" :stroke="route.color" :stroke-width="4 * routeUnit" />
        </g>
      </svg>
      <template v-for="route in routes" :key="route.id">
        <div v-for="(point, index) in route.points" :key="point.id" class="global-map-anchor" :style="anchor(point, route.color)">
          <button type="button" class="global-map-point" :class="{ 'global-map-point--selected': point.id === selectedPoint }"
            :data-point-id="point.id" :aria-label="`${route.name}, точка ${index + 1}${point.name ? ': ' + point.name : ''}`"
            :aria-pressed="point.id === selectedPoint" aria-haspopup="dialog" :aria-expanded="preview?.id === point.id"
            @pointerenter="showPreview($event, route.id, point)" @pointerleave="queueClose" @focus="showPreview($event, route.id, point); emit('select', route.id, point.id)" @blur="queueClose" @click.stop="emit('select', route.id, point.id)" @keydown.stop="pointKey($event, route.id, point)" >{{ index + 1 }}</button>

        </div>
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
import { UserRound } from '@lucide/vue'
import { ActionButton, BasePopover, LoadingState, useIsMobile } from '@sylvieshare/share-ui'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import { clamp, routePath } from '../lib/routes'
import { useGlobalMapViewport } from '../composables/useGlobalMapViewport'
import GlobalMapCallout from './GlobalMapCallout.vue'
const props = defineProps({ imageUrl: String, routes: Array, chapters: Array, participants: Array, selectedRoute: String, selectedPoint: String, addMode: Boolean, readonly: Boolean })
const emit = defineEmits(['select', 'add', 'move', 'drag-start', 'drag-end', 'remove-point', 'chapter', 'cancel-add'])
const mobile = useIsMobile(760)
const host = ref(null)
const imageGeneration = ref(0)
const v = reactive(useGlobalMapViewport(host, props, emit))
const baseUnit = computed(() => Math.max(v.image.width, v.image.height) / 1200)
const drawingScale = computed(() => Math.min(2.2, .4 + baseUnit.value * v.view.scale))
const routeUnit = computed(() => drawingScale.value / v.view.scale)
const anchor = (p, color) => ({ left: `${p.x * v.image.width}px`, top: `${p.y * v.image.height}px`, '--route-color': color, transform: `scale(${Math.max(1, drawingScale.value) / v.view.scale}) translate(-50%, -50%)` })
const routePlayers = route => props.participants.filter(player => route.playerIds.includes(player.charId))
const preview = shallowRef(null)
const previewData = computed(() => {
  const route = props.routes.find(route => route.id === preview.value?.routeId)
  const point = route?.points.find(point => point.id === preview.value?.id)
  return point ? { point, chapter: props.chapters.find(chapter => chapter.id === point.chapterId), routeName: route.name, index: route.points.indexOf(point) } : null
})
let closeTimer
function keepPreview() { clearTimeout(closeTimer) }
function hidePreview() { keepPreview(); preview.value = null }
function showPreview(event, routeId, point) {
  if (event.pointerType === 'touch' || props.addMode) return
  keepPreview(); preview.value = { id: point.id, routeId, anchor: event.currentTarget }
}
function queueClose() { keepPreview(); closeTimer = setTimeout(hidePreview, 160) }
watch(() => [v.view.x, v.view.y, v.view.scale, props.imageUrl], hidePreview)
let visibility
onMounted(() => {
  visibility = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) hidePreview() })
  visibility.observe(host.value)
})
onBeforeUnmount(() => { keepPreview(); visibility?.disconnect() })
function showChapter(chapter) { hidePreview(); emit('chapter', chapter) }
function partyStyle(route) {
  const p = route.points.at(-1)
  return { ...anchor(p, route.color), transform: `scale(${1 / v.view.scale}) translate(28px, 28px)` }
}
function key(event) {
  if (event.target.closest('[data-map-callout], button:not([data-point-id])')) return
  const route = props.routes.find(route => route.points.some(point => point.id === props.selectedPoint))
  const point = route?.points.find(point => point.id === props.selectedPoint)
  if (point) pointKey(event, route.id, point)
  if (event.key === 'Escape') { hidePreview(); emit('select', props.selectedRoute, ''); emit('cancel-add') }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); v.zoom(1.2) }
  if (event.key === '-') { event.preventDefault(); v.zoom(1 / 1.2) }
}
function pointKey(event, routeId, point) {
  if (event.key === 'Escape') { hidePreview(); emit('select', routeId, ''); emit('cancel-add'); return }
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
