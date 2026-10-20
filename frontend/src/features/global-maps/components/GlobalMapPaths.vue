<template>
  <svg class="global-map-paths" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
    <g v-for="route in shapes" :key="route.id" :opacity="!selectedRoute || route.id === selectedRoute ? 1 : .75"
      fill="none" stroke-linecap="round" :stroke-dasharray="`${8 * unit} ${12 * unit}`">
      <g v-for="leg in route.legs" :key="leg.id" :data-leg-id="leg.id">
        <path class="global-map-route-outline" :d="leg.path" :stroke-width="8 * unit" />
        <path class="global-map-route-line" :d="leg.path" :stroke="route.color" :stroke-width="4 * unit" />
      </g>
      <path v-for="segment in route.segments" :key="segment.index" class="global-map-route-hit" :d="segment.path"
        :data-route-id="route.id" :data-segment-index="segment.index" stroke="transparent" stroke-width="18" stroke-dasharray="none" vector-effect="non-scaling-stroke" />
    </g>
    <g v-if="preview" class="global-map-route-preview" fill="none" stroke-linecap="round" :stroke-dasharray="`${8 * unit} ${12 * unit}`">
      <path class="global-map-route-outline" :d="preview.path" :stroke-width="8 * unit" />
      <path :d="preview.path" :stroke="preview.color" :stroke-width="4 * unit" />
    </g>
  </svg>
</template>
<script setup>
import { computed } from 'vue'
import { routeLegs } from '../lib/routes'
import { pointIndex, resolvePoint } from '../lib/routePoints'
const props = defineProps({ routes: Array, width: Number, height: Number, unit: Number, selectedRoute: String, preview: Object, readonly: Boolean })
const shapes = computed(() => {
  const index = pointIndex(props.routes)
  return props.routes.map(route => {
    const legs = routeLegs(route.points.map(entry => ({ ...resolvePoint(entry, index), id: entry.id })), props.width, props.height)
    return { id: route.id, color: route.color, legs, segments: props.readonly ? [] : legs.flatMap(leg => leg.segments) }
  })
})
</script>
<style scoped>
.global-map-paths { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.global-map-route-outline { stroke: var(--map-screen-void); }
.global-map-route-hit { pointer-events: stroke; cursor: grab; }
.global-map-route-hit:active { cursor: grabbing; }
.global-map-route-preview { opacity: .8; pointer-events: none; }
</style>
