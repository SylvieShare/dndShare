<template>
  <WorkspaceFocusPanel :open="visible && !!route" :focus-key="route?.id" class="global-map-route-inspector" aria-label="Настройки маршрута" @keydown.esc="dismiss">
    <InspectorContent v-if="route">
      <template #heading><InspectorHeading :name="route.name" :icon="Route" :color="route.color" editable :disabled="disabled" label="Название маршрута" :maxlength="120" @rename="emit('change', { name: $event })" /></template>
      <fieldset class="global-map-route-actions" :disabled="disabled"><ColorPresetPicker variant="button" :model-value="route.color" :colors="ROUTE_COLORS" allow-custom aria-label="Цвет маршрута" custom-label="Свой цвет маршрута" @update:model-value="emit('change', { color: $event })" /></fieldset>
      <GlobalMapRoutePoints :route="route" :routes="routes" :chapters="chapters" :disabled="disabled" @reorder="emit('reorder', $event)" @select-point="emit('select-point', $event)" @delete-point="emit('delete-point', $event)" @add-mode="emit('add-mode')" />
    </InspectorContent>
  </WorkspaceFocusPanel>
</template>
<script setup>
import { ColorPresetPicker } from '@sylvieshare/share-ui'
import { Route } from '@lucide/vue'
import WorkspaceFocusPanel from '@/shared/ui/WorkspaceFocusPanel.vue'
import InspectorContent from '@/shared/ui/InspectorContent.vue'
import InspectorHeading from '@/shared/ui/InspectorHeading.vue'
import { ROUTE_COLORS } from '../lib/routes'
import GlobalMapRoutePoints from './GlobalMapRoutePoints.vue'
defineProps({ route: Object, routes: Array, chapters: Array, disabled: Boolean, visible: Boolean })
const emit = defineEmits(['change', 'dismiss', 'reorder', 'select-point', 'delete-point', 'add-mode'])
function dismiss(event) {
  if (document.querySelector('.share-popover, [role="dialog"]')) return
  event.stopPropagation()
  emit('dismiss')
}
</script>
<style scoped>
.global-map-route-actions { display: flex; align-items: center; gap: 8px; border: 0; padding: 0; margin: 0; }
</style>
