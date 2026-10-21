<template>
  <div ref="host" class="global-map-point-preview" role="figure" :aria-label="`Точка на карте: ${point.name || 'Точка маршрута'}. Увеличение ×2`" :data-preview-state="state">
    <div v-if="viewport?.loaded && bounds.width" class="global-map-preview-scene" :style="scene" aria-hidden="true">
      <img :key="imageUrl" :src="imageUrl" alt="" draggable="false" @load="imageReady = true; failed = false" @error="failed = true" />
      <GlobalMapPaths :routes="routes" :width="viewport.width" :height="viewport.height" :unit="drawing.route" :selected-route="routeId" readonly />
      <GlobalMapMarker v-for="marker in markers" :key="marker.sourceId" :marker="marker" :interactive="false" :selected="marker.id === point.id" :style="mapPointAnchor(marker, viewport, drawing.marker / 2, marker.color)" />
    </div>
    <span class="global-map-preview-zoom" aria-hidden="true">×2</span>
    <LoadingState v-if="state === 'loading'" class="global-map-preview-message" label="Загружаем превью точки…" compact />
    <span v-else-if="state === 'unavailable'" class="global-map-preview-message">Не удалось открыть изображение карты</span>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { LoadingState } from '@sylvieshare/share-ui'
import GlobalMapMarker from './GlobalMapMarker.vue'
import GlobalMapPaths from './GlobalMapPaths.vue'
import { mapMarkers } from '../lib/routePoints'
import { mapDrawingUnits, mapPointAnchor, pointPreviewView } from '../lib/mapDrawing'
const props = defineProps({ point: Object, routes: Array, routeId: String, viewport: Object, imageUrl: String })
const host = ref(null), bounds = reactive({ width: 0, height: 0 }), imageReady = ref(false), failed = ref(false)
const state = computed(() => failed.value || props.viewport?.error ? 'unavailable' : imageReady.value && bounds.width ? 'ready' : 'loading')
const drawing = computed(() => props.viewport ? mapDrawingUnits(props.viewport, props.viewport.scale) : { route: 1, marker: 1 })
const scene = computed(() => props.viewport ? pointPreviewView(props.point, props.viewport, props.viewport.scale, bounds) : {})
const markers = computed(() => mapMarkers(props.routes, props.routeId, props.point.id).filter(marker => !marker.control))
let observer
watch(() => props.imageUrl, () => { imageReady.value = false; failed.value = false })
onMounted(() => {
  observer = new ResizeObserver(() => { const rect = host.value.getBoundingClientRect(); bounds.width = rect.width; bounds.height = rect.height })
  observer.observe(host.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<style scoped>
.global-map-point-preview { position: relative; width: 100%; height: 100%; overflow: hidden; isolation: isolate; }
.global-map-preview-scene { position: absolute; top: 0; left: 0; transform-origin: 0 0; pointer-events: none; }
.global-map-preview-scene > img { display: block; width: 100%; height: 100%; }
.global-map-preview-zoom { position: absolute; z-index: 5; right: 6px; top: 6px; padding: 3px 5px; border-radius: 4px; background: var(--surface); color: var(--text-2); font-size: 10px; }
.global-map-preview-message { position: absolute; z-index: 6; inset: 0; display: grid; place-items: center; padding: 12px; background: var(--surface); color: var(--text-muted); font-size: 11px; text-align: center; }
</style>
