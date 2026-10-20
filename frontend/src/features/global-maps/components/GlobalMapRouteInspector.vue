<template>
  <WorkspaceFocusPanel :open="visible && !!route" :focus-key="route?.id" class="global-map-route-inspector" aria-label="Настройки маршрута">
    <InspectorContent v-if="route">
      <template #heading><header class="global-map-route-heading"><Route :size="20" :style="{ color: route.color }" /><h3>{{ route.name }}</h3><ActionButton icon-only variant="quiet" aria-label="Закрыть настройки маршрута" @click="emit('close')"><template #icon><X :size="18" /></template></ActionButton></header></template>
      <GlobalMapRouteSettings :route="route" :participants="participants" :disabled="disabled" @change="emit('change', $event)" />
      <GlobalMapRoutePoints :route="route" :routes="routes" :chapters="chapters" :disabled="disabled" @reorder="emit('reorder', $event)" @select-point="emit('select-point', $event)" @delete-point="emit('delete-point', $event)" @add-mode="emit('add-mode')" @reuse-point="emit('reuse-point', $event)" />
    </InspectorContent>
  </WorkspaceFocusPanel>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Route, X } from '@lucide/vue'
import WorkspaceFocusPanel from '@/shared/ui/WorkspaceFocusPanel.vue'
import InspectorContent from '@/shared/ui/InspectorContent.vue'
import GlobalMapRouteSettings from './GlobalMapRouteSettings.vue'
import GlobalMapRoutePoints from './GlobalMapRoutePoints.vue'
defineProps({ route: Object, routes: Array, participants: Array, chapters: Array, disabled: Boolean, visible: Boolean })
const emit = defineEmits(['change', 'close', 'reorder', 'select-point', 'delete-point', 'add-mode', 'reuse-point'])
</script>
<style scoped>
.global-map-route-heading { display: flex; gap: 8px; align-items: center; }
h3 { flex: 1; margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 18px; color: var(--text-1); }
.global-map-route-heading > svg { flex: none; }
</style>
