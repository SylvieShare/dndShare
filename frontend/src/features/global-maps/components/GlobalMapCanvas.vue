<template>
  <div ref="host" class="global-map-canvas" :class="{ 'global-map-canvas--adding': addMode && !readonly }"
    tabindex="0" aria-label="Глобальная карта. Колесо — масштаб, Обзор — перемещение, точки можно перетаскивать."
    @pointerdown="v.down" @pointermove="v.move" @pointerup="v.end($event)" @pointercancel="v.end($event, true)"
    @lostpointercapture="v.end($event, true)" @wheel.prevent="v.zoom(Math.exp(-$event.deltaY * .001), $event)" @keydown.stop="key">
    <div class="global-map-world" :style="v.style">
      <img :key="imageGeneration" class="global-map-image" :src="imageUrl" alt="Глобальная карта" draggable="false" @load="v.load" @error="v.imageError = true" />
      <svg class="global-map-paths" :viewBox="`0 0 ${v.image.width} ${v.image.height}`" aria-hidden="true">
        <path v-for="route in routes" :key="route.id" :d="routePath(route.points, v.image.width, v.image.height)"
          :stroke="route.color" fill="none" stroke-width="3" stroke-dasharray="5 9" stroke-linecap="round" vector-effect="non-scaling-stroke"
          :opacity="!selectedRoute || route.id === selectedRoute ? 1 : .55" />
      </svg>
      <template v-for="route in routes" :key="route.id">
        <div v-for="(point, index) in route.points" :key="point.id" class="global-map-anchor" :style="anchor(point, route.color)">
          <button type="button" class="global-map-point" :class="{ 'global-map-point--selected': point.id === selectedPoint }"
            :data-point-id="point.id" :aria-label="`${route.name}, точка ${index + 1}${point.name ? ': ' + point.name : ''}`"
            :title="point.note || point.name || `Точка ${index + 1}`" :aria-pressed="point.id === selectedPoint"
            @focus="emit('select', route.id, point.id)" @keydown.stop="pointKey($event, route.id, point)" >{{ index + 1 }}</button>
          <GlobalMapCallout v-if="labels && (point.note || point.name || chapter(point))" :point="point" :chapter="chapter(point)"
            @chapter="emit('chapter', $event)" />
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
    <LoadingState v-if="!v.loaded && !v.imageError" class="global-map-message" label="Загружаем изображение…" />
    <div v-if="v.imageError" class="global-map-message" role="alert">Не удалось открыть изображение карты.
      <ActionButton variant="secondary" @pointerdown.stop @click="v.imageError = false; v.loaded = false; imageGeneration++">Повторить загрузку изображения</ActionButton>
    </div>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { UserRound } from '@lucide/vue'
import { ActionButton, LoadingState } from '@sylvieshare/share-ui'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import { clamp, routePath } from '../lib/routes'
import { useGlobalMapViewport } from '../composables/useGlobalMapViewport'
import GlobalMapCallout from './GlobalMapCallout.vue'
const props = defineProps({ imageUrl: String, routes: Array, chapters: Array, participants: Array, selectedRoute: String, selectedPoint: String, addMode: Boolean, readonly: Boolean, labels: Boolean })
const emit = defineEmits(['select', 'add', 'move', 'drag-start', 'drag-end', 'remove-point', 'chapter'])
const host = ref(null)
const imageGeneration = ref(0)
const v = reactive(useGlobalMapViewport(host, props, emit))
const chapter = point => props.chapters.find(chapter => chapter.id === point.chapterId)
const routePlayers = route => props.participants.filter(player => route.playerIds.includes(player.charId))
const anchor = (p, color) => ({ left: `${p.x * v.image.width}px`, top: `${p.y * v.image.height}px`, '--route-color': color, transform: `scale(${1 / v.view.scale}) translate(-50%, -50%)` })
function partyStyle(route) {
  const p = route.points.at(-1)
  return { ...anchor(p, route.color), transform: `scale(${1 / v.view.scale}) translate(28px, 28px)` }
}
function key(event) {
  if (event.target.closest('[data-map-callout], button:not([data-point-id])')) return
  const route = props.routes.find(route => route.points.some(point => point.id === props.selectedPoint))
  const point = route?.points.find(point => point.id === props.selectedPoint)
  if (point) pointKey(event, route.id, point)
  if (event.key === 'Escape') emit('select', props.selectedRoute, '')
  if (event.key === '+' || event.key === '=') { event.preventDefault(); v.zoom(1.2) }
  if (event.key === '-') { event.preventDefault(); v.zoom(1 / 1.2) }
}
function pointKey(event, routeId, point) {
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
