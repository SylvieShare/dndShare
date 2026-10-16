<template>
  <MapSidebar ref="sidebar" v-model:tab="tab" class="global-map-sidebar" :tabs="tabs" aria-label="Глобальные карты и маршруты">
    <template v-if="tab === 'maps'">
      <AddButton block label="Загрузить карту" :disabled="controller.busy || controller.maps.length >= 32" @click="file?.click()" />
      <input ref="file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Изображение глобальной карты" hidden @change="upload" />
      <p class="map-hint">PNG, JPG или WebP до 15 МБ. У каждой карты свои маршруты.</p>
      <LoadingState v-if="controller.busy" label="Обрабатываем карту…" compact />
      <div v-for="map in controller.maps" :key="map.id" class="global-map-list-entry">
        <button type="button" class="global-map-thumbnail" :class="{ 'global-map-thumbnail--selected': map.id === controller.selectedId }"
          :aria-label="`Открыть карту ${map.name}`" :aria-pressed="map.id === controller.selectedId" @click="controller.selectedId = map.id">
          <img :src="map.imageUrl" alt="" loading="lazy" decoding="async" /><span>{{ map.name }}<small v-if="map.current">Текущая</small></span>
        </button>
      </div>
      <template v-if="controller.selected">
        <FormField label="Название карты" vertical><FormTextInput :value="controller.selected.name" :maxlength="160" :disabled="locked"
          aria-label="Название глобальной карты" @update:value="controller.change(map => { map.name = $event })" /></FormField>
        <ActionButton v-if="!controller.selected.current" variant="secondary" :disabled="controller.busy" @click="controller.activate(controller.selected.id)">
          <template #icon><Check :size="16" /></template>Сделать текущей
        </ActionButton>
        <ActionButton variant="quiet" :disabled="controller.busy" @click="emit('delete-map', controller.selected)">
          <template #icon><Trash2 :size="16" /></template>Удалить карту
        </ActionButton>
      </template>
    </template>
    <template v-else>
      <p v-if="!controller.selected" class="map-hint">Сначала загрузите карту.</p>
      <template v-else>
        <AddButton block label="Добавить маршрут" :disabled="locked || controller.selected.routes.length >= 64" @click="emit('add-route')" />
        <p v-if="!controller.selected.routes.length" class="map-hint">Создайте маршрут и ставьте точки на изображении. Их порядок задаёт направление пути.</p>
        <ActionButton v-for="(route, index) in controller.selected.routes" :key="route.id" :variant="route.id === selectedRoute ? 'primary' : 'quiet'"
          @click="emit('select-route', route.id)">
          <template #icon><Route :size="18" :style="{ color: route.color }" /></template>{{ route.name || `Маршрут ${index + 1}` }} · {{ route.points.length }}
        </ActionButton>
        <GlobalMapRouteSettings v-if="route" :route="route" :participants="participants" :disabled="locked"
          @change="emit('route-change', $event)" @delete="emit('delete-route', route)" />
        <DetailSection v-if="route" label="Точки маршрута">
          <div class="global-map-points-list">
            <AddButton block label="Добавить точки на карту" :disabled="locked" @click="emit('add-mode')" />
            <ActionButton v-for="(point, index) in route.points" :key="point.id" :variant="point.id === selectedPoint ? 'primary' : 'quiet'"
              @click="emit('select-point', point.id)">{{ index + 1 }}. {{ point.name || chapters.find(chapter => chapter.id === point.chapterId)?.name || 'Точка маршрута' }}<StickyNote v-if="point.note" :size="14" /></ActionButton>
          </div>
        </DetailSection>
      </template>
    </template>
  </MapSidebar>
</template>
<script setup>
import { computed, ref } from 'vue'
import { AddButton, ActionButton, DetailSection, FormField, FormTextInput, LoadingState } from '@sylvieshare/share-ui'
import { Check, Images, Route, StickyNote, Trash2 } from '@lucide/vue'
import MapSidebar from '@/features/maps/components/MapSidebar.vue'
import GlobalMapRouteSettings from './GlobalMapRouteSettings.vue'
const props = defineProps({ controller: Object, selectedRoute: String, selectedPoint: String, participants: Array, chapters: Array })
const emit = defineEmits(['delete-map', 'add-route', 'select-route', 'delete-route', 'route-change', 'select-point', 'add-mode'])
const sidebar = ref(null), file = ref(null), tab = ref('maps')
const tabs = [{ key: 'maps', label: 'Карты мира', icon: Images }, { key: 'routes', label: 'Маршруты', icon: Route }]
const route = computed(() => props.controller.selected?.routes.find(route => route.id === props.selectedRoute))
const locked = computed(() => props.controller.conflict || props.controller.busy)
function upload(event) { props.controller.upload(event.target.files?.[0]); event.target.value = '' }
defineExpose({ openRoutes: () => sidebar.value?.openTab('routes'), collapse: () => sidebar.value?.collapse() })
</script>
<style scoped>
.global-map-thumbnail { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.global-map-thumbnail--selected { border-color: var(--accent); }
.global-map-thumbnail img { width: 68px; height: 46px; object-fit: cover; border-radius: 5px; }
.global-map-thumbnail span { min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
.global-map-thumbnail small { display: block; color: var(--accent-soft); margin-top: 4px; font-size: 10px; }
.global-map-points-list { display: flex; flex-direction: column; gap: 5px; }
</style>
