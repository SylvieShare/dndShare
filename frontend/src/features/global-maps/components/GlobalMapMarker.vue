<template>
  <div class="global-map-anchor" :class="{ 'global-map-anchor--control': marker.control, 'global-map-anchor--hidden': hidden, 'global-map-anchor--selected': selected }">
    <component :is="interactive ? 'button' : 'span'" :type="interactive ? 'button' : undefined" class="world-map-point"
      :class="[marker.control ? 'global-map-control' : interactive ? 'global-map-point' : 'global-map-preview-point', { 'global-map-point--selected': selected }]"
      :data-point-id="interactive ? marker.id : undefined" :data-route-id="interactive ? marker.routeId : undefined" :data-source-id="interactive ? marker.sourceId : undefined"
      :data-control="interactive && marker.control || undefined" :data-position="interactive ? marker.position : undefined"
      :tabindex="interactive ? hidden ? -1 : 0 : undefined" :aria-hidden="hidden || !interactive || undefined"
      :aria-label="interactive ? marker.control ? `Узел изгиба: ${marker.routeName}` : `${marker.routeName}, точка ${marker.numbers.join(', ')}${marker.name ? ': ' + marker.name : ''}` : undefined"
      :aria-pressed="interactive ? selected : undefined" :aria-haspopup="interactive && !marker.control ? 'dialog' : undefined" :aria-expanded="interactive ? expanded : undefined"
      @pointerenter="emit('enter', $event)" @pointerleave="emit('leave')" @focus="emit('focus', $event)" @blur="emit('blur')" @click.stop="emit('activate', $event)" @keydown="emit('key', $event)">
      <template v-if="!marker.control">{{ marker.numbers.length <= 2 ? marker.numbers.join('·') : `${marker.number}↻` }}</template>
    </component>
    <span v-if="marker.last" class="global-map-endpoint" role="img" :aria-label="interactive ? 'Последняя точка маршрута' : undefined" :aria-hidden="!interactive || undefined" title="Последняя точка · Cmd/Ctrl — продолжить маршрут"><FlagTriangleRight :size="13" /></span>
  </div>
</template>
<script setup>
import { FlagTriangleRight } from '@lucide/vue'
defineProps({ marker: Object, selected: Boolean, expanded: Boolean, hidden: Boolean, interactive: { type: Boolean, default: true } })
const emit = defineEmits(['enter', 'leave', 'focus', 'blur', 'activate', 'key'])
</script>
<style scoped>
.global-map-anchor { position: absolute; width: 30px; height: 30px; transform-origin: 0 0; z-index: 2; }
.global-map-anchor--selected { z-index: 4; }
.world-map-point { display: grid; place-items: center; width: 30px; height: 30px; box-sizing: border-box; padding: 0; border: 3px solid var(--route-color); border-radius: 50%; background: var(--map-screen-void); color: var(--text-on-accent); font: 800 11px/1 var(--font-ui); box-shadow: 0 0 0 2px var(--map-screen-void), 0 2px 6px color-mix(in srgb, var(--bg) 65%, transparent); transition: box-shadow .15s ease; }
.global-map-point { cursor: move; }
.global-map-point:hover, .global-map-point:focus-visible { outline: 2px solid var(--text-on-accent); outline-offset: 3px; }
.global-map-point--selected { box-shadow: 0 0 0 2px var(--map-screen-void), 0 0 0 4px var(--text-on-accent), 0 0 0 7px color-mix(in srgb, var(--route-color) 55%, transparent); }
.global-map-endpoint { position: absolute; top: -10px; left: -10px; width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid var(--route-color); border-radius: 50%; background: var(--map-screen-void); color: var(--text-on-accent); pointer-events: none; }
.global-map-anchor--control { width: 14px; height: 14px; transition: opacity .12s ease, visibility .12s; }
.global-map-anchor--hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.global-map-control { width: 14px; height: 14px; padding: 0; border: 2px solid var(--route-color); background: var(--map-screen-void); border-radius: 3px; box-shadow: 0 0 0 2px var(--map-screen-void); transform: rotate(45deg); cursor: move; }
.global-map-control.global-map-point--selected, .global-map-control:focus-visible { outline: 2px solid var(--text-on-accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .world-map-point, .global-map-anchor--control { transition: none; } }
</style>
