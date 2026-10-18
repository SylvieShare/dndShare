<template>
  <MapSidebar ref="sidebar" v-model:tab="tab" class="global-map-sidebar" :tabs="tabs" aria-label="Карты мира и маршруты"
    @resize="(_, width) => { if (width > 0) emit('navigation-width', width) }">
    <p v-if="controller.selected" class="global-map-save-status" role="status">{{ controller.saving ? 'Сохраняем…' : controller.hasPending() ? 'Есть несохранённые изменения' : 'Сохранено' }}</p>
    <template v-if="tab === 'maps'">
      <AddButton block label="Загрузить карту" :disabled="controller.busy || controller.maps.length >= 32" @click="file?.click()" />
      <input ref="file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Изображение карты мира" hidden @change="upload" />
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
          aria-label="Название карты мира" @update:value="controller.change(map => { map.name = $event })" /></FormField>
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
        <p v-if="!controller.selected.routes.length" class="map-hint">Создайте маршрут и ставьте точки на изображении. Их порядок задаёт направление пути. Cmd/Ctrl показывает продолжение от последней точки; можно выбрать уже существующую точку.</p>
        <ActionButton v-for="(route, index) in controller.selected.routes" :key="route.id" :variant="route.id === selectedRoute ? 'primary' : 'quiet'"
          @click="emit('select-route', route.id)">
          <template #icon><Route :size="18" :style="{ color: route.color }" /></template>{{ route.name || `Маршрут ${index + 1}` }} · {{ waypointEntries(route).length }}
        </ActionButton>
        <GlobalMapRouteSettings v-if="route" :route="route" :participants="participants" :disabled="locked"
          @change="emit('route-change', $event)" @delete="emit('delete-route', route)" />
        <div v-if="route" class="global-map-mode" role="group" aria-label="Режим карты мира">
          <ActionButton :variant="addMode ? 'primary' : 'secondary'" :disabled="locked" @click="emit('add-mode')"><template #icon><MapPinPlus :size="16" /></template>Точки</ActionButton>
          <ActionButton :variant="!addMode ? 'primary' : 'secondary'" @click="emit('browse')"><template #icon><Hand :size="16" /></template>Обзор</ActionButton>
        </div>
        <DetailSection v-if="route" label="Точки маршрута">
          <div class="global-map-points-list">
            <p class="map-hint">Флажок отмечает конец пути. Cmd/Ctrl — продолжить маршрут, Esc — отменить превью. Потяните линию, чтобы создать узел изгиба.</p>
            <AddButton block label="Добавить точки на карту" :disabled="locked" @click="emit('add-mode')" />
            <FormField label="Добавить существующую точку" vertical>
              <FormSelect :value="reuseId" :disabled="locked || !choices.length" aria-label="Добавить существующую точку" @change="reuse">
                <option value="">Выберите точку…</option><option v-for="point in choices" :key="point.sourceId" :value="point.sourceId">{{ point.name || `Точка ${point.number}` }} · {{ point.routeName }}</option>
              </FormSelect>
            </FormField>
            <ActionButton v-for="(point, index) in visits" :key="point.id" :variant="point.id === selectedPoint ? 'primary' : 'quiet'"
              @click="emit('select-point', point.id)">{{ index + 1 }}. {{ point.name || chapters.find(chapter => chapter.id === point.chapterId)?.name || 'Точка маршрута' }}<Link2 v-if="point.sourceId !== point.id" :size="14" aria-label="Повторное посещение" /><StickyNote v-if="point.note" :size="14" /><FlagTriangleRight v-if="index === visits.length - 1" :size="15" aria-label="Последняя точка маршрута" /></ActionButton>
          </div>
        </DetailSection>
      </template>
    </template>
  </MapSidebar>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue'
import { AddButton, ActionButton, DetailSection, FormField, FormSelect, FormTextInput, LoadingState } from '@sylvieshare/share-ui'
import { Check, FlagTriangleRight, Hand, Images, Link2, MapPinPlus, Route, StickyNote, Trash2 } from '@lucide/vue'
import MapSidebar from '@/features/maps/components/MapSidebar.vue'
import { lastWaypoint, mapMarkers, routeVisits, waypointEntries } from '../lib/routePoints'
import GlobalMapRouteSettings from './GlobalMapRouteSettings.vue'
const props = defineProps({ controller: Object, addMode: Boolean, selectedRoute: String, selectedPoint: String, participants: Array, chapters: Array })
const emit = defineEmits(['delete-map', 'add-route', 'select-route', 'delete-route', 'route-change', 'select-point', 'add-mode', 'navigation-width', 'browse', 'reuse-point'])
const sidebar = ref(null), file = ref(null), tab = ref('maps'), reuseId = ref('')
const tabs = [{ key: 'maps', label: 'Карты мира', icon: Images }, { key: 'routes', label: 'Маршруты', icon: Route }]
const route = computed(() => props.controller.selected?.routes.find(route => route.id === props.selectedRoute))
const visits = computed(() => route.value ? routeVisits(route.value, props.controller.selected.routes) : [])
const choices = computed(() => {
  const tail = lastWaypoint(route.value)
  return mapMarkers(props.controller.selected?.routes || [], props.selectedRoute, props.selectedPoint).filter(point => !point.control && point.sourceId !== (tail?.refId || tail?.id))
})
function reuse(id) { if (!id) return; reuseId.value = id; emit('reuse-point', id); nextTick(() => { reuseId.value = '' }) }
const locked = computed(() => props.controller.conflict || props.controller.busy)
function upload(event) { props.controller.upload(event.target.files?.[0]); event.target.value = '' }
defineExpose({ openRoutes: () => sidebar.value?.openTab('routes'), collapse: () => sidebar.value?.collapse() })
</script>
<style scoped>
.global-map-save-status { font-size: 10px; color: var(--text-muted); margin: 0; }
.global-map-mode { display: flex; flex-wrap: wrap; gap: 6px; }
.global-map-thumbnail { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.global-map-thumbnail--selected { border-color: var(--accent); }
.global-map-thumbnail img { width: 68px; height: 46px; object-fit: cover; border-radius: 5px; }
.global-map-thumbnail span { min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
.global-map-thumbnail small { display: block; color: var(--accent-soft); margin-top: 4px; font-size: 10px; }
.global-map-points-list { display: flex; flex-direction: column; gap: 5px; }
</style>
