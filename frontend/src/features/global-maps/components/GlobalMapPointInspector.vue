<template>
  <WorkspaceFocusPanel :open="visible && !!point && !!route" :focus-key="point?.id" class="global-map-point-inspector" aria-label="Настройки точки" @keydown.esc="dismiss">
    <InspectorContent v-if="point && route">
      <template #heading><InspectorHeading :name="point.name || `Точка ${index + 1}`" :value="point.name" :icon="MapPin" :color="route.color" editable :disabled="disabled" label="Название точки" @rename="emit('change', { name: $event })" /></template>
      <InspectorPreview>
        <GlobalMapPointPreview :point="point" :routes="routes" :route-id="route.id" :image-url="imageUrl" :viewport="viewport" />
        <template #actions><ActionButton icon-only variant="quiet" :disabled="disabled" aria-label="Удалить точку" title="Удалить точку" @click="emit('delete')"><template #icon><Trash2 :size="18" :style="{ color: 'var(--danger)' }" /></template></ActionButton></template>
      </InspectorPreview>
      <div class="global-map-point-route"><InspectorReference :name="route.name" :color="route.color" :icon="Route" :label="`Открыть маршрут ${route.name}`" @activate="emit('route')" /></div>
    <GlobalMapPointLinks title="Главы" kind="chapter" add-label="Добавить главу" empty-label="В сессии пока нет глав" :items="chapters" :selected-ids="pointChapterIds(point)" :disabled="disabled" @update="emit('change', chapterLinksPatch($event))" @open="emit('chapter', $event)" />
    <GlobalMapPointLinks title="Локации" kind="location" add-label="Добавить локацию" empty-label="В справочнике сессии пока нет локаций" :items="locations" :selected-ids="point.locationIds || []" :disabled="disabled" @update="emit('change', { locationIds: $event })" @open="emit('location', $event)" />
    <FormField label="Заметка на карте" vertical><FormTextarea :value="point.note" :rows="3" :maxlength="2000" :disabled="disabled" placeholder="Место встречи, опасный перевал…" aria-label="Заметка точки" @update:value="emit('change', { note: $event })" /></FormField>
    </InspectorContent>
  </WorkspaceFocusPanel>
</template>
<script setup>
import { ActionButton, FormField, FormTextarea } from '@sylvieshare/share-ui'
import { Route, MapPin, Trash2 } from '@lucide/vue'
import InspectorHeading from '@/shared/ui/InspectorHeading.vue'
import InspectorPreview from '@/shared/ui/InspectorPreview.vue'
import InspectorReference from '@/shared/ui/InspectorReference.vue'
import GlobalMapPointPreview from './GlobalMapPointPreview.vue'
import WorkspaceFocusPanel from '@/shared/ui/WorkspaceFocusPanel.vue'
import GlobalMapPointLinks from './GlobalMapPointLinks.vue'
import { pointChapterIds, chapterLinksPatch } from '../lib/pointLinks'
import InspectorContent from '@/shared/ui/InspectorContent.vue'
defineProps({ point: Object, route: Object, routes: Array, imageUrl: String, viewport: Object, index: Number, chapters: Array, locations: Array, disabled: Boolean, visible: { type: Boolean, default: true } })
const emit = defineEmits(['change', 'dismiss', 'route', 'delete', 'chapter', 'location'])
function dismiss(event) {
  if (document.querySelector('.share-popover, [role="dialog"]')) return
  event.stopPropagation()
  emit('dismiss')
}
</script>
<style scoped>
.global-map-point-route { margin-top: -17px; }
</style>
