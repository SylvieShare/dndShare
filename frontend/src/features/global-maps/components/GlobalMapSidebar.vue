<template>
  <MapSidebar ref="sidebar" v-model:tab="tab" class="global-map-sidebar" :tabs="tabs" aria-label="Карты мира и маршруты"
    @resize="(_, width) => { if (width > 0) emit('navigation-width', width) }">
    <p v-if="controller.selected" class="global-map-save-status" role="status">{{ controller.saving ? 'Сохраняем…' : controller.hasPending() ? 'Есть несохранённые изменения' : 'Сохранено' }}</p>
    <template v-if="tab === 'maps'">
      <AddButton block label="Загрузить карту" :disabled="controller.busy || controller.maps.length >= 32" @click="file?.click()" />
      <input ref="file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Изображение карты мира" hidden @change="upload" />
      <p class="map-hint">PNG, JPG или WebP до 15 МБ. У каждой карты свои маршруты.</p>
      <LoadingState v-if="controller.busy" label="Обрабатываем карту…" compact />
      <BaseTile v-for="map in controller.maps" :key="map.id" framed class="global-map-thumbnail" :class="{ 'global-map-thumbnail--selected': map.id === controller.selectedId }" @click="controller.selectedId = map.id">
        <button type="button" class="global-map-map-image" :aria-label="`Открыть карту ${map.name}`" :aria-pressed="map.id === controller.selectedId" @click.stop="controller.selectedId = map.id"><img :src="map.imageUrl" alt="" loading="lazy" decoding="async" /></button>
        <div class="global-map-map-title" @click.stop>
          <InlineEdit :model-value="map.name" :label="`Название карты ${map.name}`" :edit-label="`Переименовать карту ${map.name}`" :maxlength="160" required :disabled="locked" confirm-label="Сохранить название" cancel-label="Отмена" @confirm="controller.rename(map.id, $event.trim())" />
          <small v-if="map.current">Текущая</small>
        </div>
        <RemoveButton icon="trash" :label="`Удалить карту ${map.name}`" :disabled="locked" @click.stop="emit('delete-map', map)" />
      </BaseTile>
      <ActionButton v-if="controller.selected && !controller.selected.current" variant="secondary" :disabled="locked" @click="controller.activate(controller.selected.id)"><template #icon><Check :size="16" /></template>Сделать текущей</ActionButton>
    </template>
    <template v-else>
      <p v-if="!controller.selected" class="map-hint">Сначала загрузите карту.</p>
      <template v-else>
        <AddButton block label="Добавить маршрут" :disabled="locked || controller.selected.routes.length >= 64" @click="emit('add-route')" />
        <p v-if="!controller.selected.routes.length" class="map-hint">Создайте маршрут, затем добавьте в нём точки на карту.</p>
        <BaseTile v-for="(route, index) in controller.selected.routes" :key="route.id" framed class="global-map-route-tile" :class="{ 'global-map-route-tile--selected': route.id === selectedRoute }">
          <ActionButton variant="quiet" class="global-map-route-open" :aria-label="`Открыть маршрут ${route.name || `Маршрут ${index + 1}`}`" @click="emit('select-route', route.id)"><template #icon><Route :size="19" :style="{ color: route.color }" /></template>{{ route.name || `Маршрут ${index + 1}` }}<small>Точек: {{ waypointEntries(route).length }}</small></ActionButton>
          <RemoveButton icon="trash" :label="`Удалить маршрут ${route.name}`" :disabled="locked" @click="emit('delete-route', route)" />
        </BaseTile>
      </template>
    </template>
  </MapSidebar>
</template>
<script setup>
import { computed, ref } from 'vue'
import { AddButton, ActionButton, BaseTile, InlineEdit, LoadingState, RemoveButton } from '@sylvieshare/share-ui'
import { Check, Images, Route } from '@lucide/vue'
import MapSidebar from '@/features/maps/components/MapSidebar.vue'
import { waypointEntries } from '../lib/routePoints'
const props = defineProps({ controller: Object, selectedRoute: String })
const emit = defineEmits(['delete-map', 'add-route', 'select-route', 'delete-route', 'navigation-width'])
const sidebar = ref(null), file = ref(null), tab = ref('maps')
const tabs = [{ key: 'maps', label: 'Карты мира', icon: Images }, { key: 'routes', label: 'Маршруты', icon: Route }]
const locked = computed(() => props.controller.conflict || props.controller.busy)
function upload(event) { props.controller.upload(event.target.files?.[0]); event.target.value = '' }
defineExpose({ openRoutes: () => sidebar.value?.openTab('routes'), collapse: () => sidebar.value?.collapse() })
</script>
<style scoped>
.global-map-save-status { font-size: 10px; color: var(--text-muted); margin: 0; }
.global-map-thumbnail { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px; cursor: pointer; }
.global-map-thumbnail--selected, .global-map-route-tile--selected { border-color: var(--accent); }
.global-map-map-image { border: 0; padding: 0; background: none; cursor: pointer; }
.global-map-map-image img { display: block; width: 56px; height: 46px; object-fit: cover; border-radius: 5px; }
.global-map-map-title { min-width: 0; font-size: 12px; --inline-edit-min-width: 0px; }
.global-map-map-title small { display: block; color: var(--accent-soft); font-size: 10px; }
.global-map-route-tile { display: flex; align-items: center; gap: 3px; padding: 4px 8px 4px 2px; }
.global-map-route-open { flex: 1; min-width: 0; justify-content: flex-start; text-align: left; }
.global-map-route-open :deep(> span) { min-width: 0; overflow-wrap: anywhere; }
.global-map-route-open small { display: block; margin-top: 4px; font-size: 10px; color: var(--text-muted); }
</style>
