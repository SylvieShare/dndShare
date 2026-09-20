<template>
  <span v-if="disabled" class="map-coming-soon"
    @mouseenter="show" @mouseleave="anchor = null" @focusin="show" @focusout="anchor = null"
    @click.capture.stop.prevent="show" @keydown.enter.stop.prevent="show"
    @keydown.space.stop.prevent="show" @keydown.esc="anchor = null">
    <slot />
    <FloatingTooltip v-if="anchor" :anchor="anchor" :min-width="0">Скоро будет</FloatingTooltip>
  </span>
  <slot v-else />
</template>
<script setup>
import { shallowRef } from 'vue'
import { FloatingTooltip } from '@sylvieshare/share-ui'
defineProps({ disabled: Boolean })
const anchor = shallowRef(null)
function show(event) {
  anchor.value = event.currentTarget.querySelector('button') || event.target.closest('button')
}
</script>
<style scoped>
.map-coming-soon { display: contents; }
.map-coming-soon :deep(button), .map-coming-soon :deep(button:hover) {
  color: var(--text-muted);
  opacity: .45;
  cursor: not-allowed;
  background: transparent;
}
</style>
