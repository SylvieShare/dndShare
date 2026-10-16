<template>
  <section class="global-map-workspace" data-tutorial="session-global-map">
    <GlobalMapSidebar ref="sidebar" :controller="c" :selected-route="routeId" :selected-point="pointId" :participants="participants" :chapters="chapters"
      @add-route="addRoute" @select-route="selectRoute" @select-point="selectPoint" @route-change="changeRoute"
      @delete-map="map => pending = { kind: 'map', item: map }" @delete-route="route => pending = { kind: 'route', item: route }" @add-mode="startAdding" />
    <div class="global-map-main">
      <LoadingState v-if="c.loading" label="Открываем глобальные карты…" fill />
      <template v-else-if="c.selected">
        <GlobalMapCanvas :key="c.selected.id" ref="canvas" :image-url="c.selected.imageUrl" :routes="c.selected.routes"
          :chapters="chapters" :participants="participants" :selected-route="routeId" :selected-point="pointId"
          :readonly="c.conflict || c.busy" :add-mode="addMode && !!route" :labels="labels"
          @select="select" @add="addPoint" @move="move" @drag-start="c.editing = true" @drag-end="endDrag"
          @remove-point="requestPointDelete" @chapter="emit('open-chapter', $event)" />
        <header class="global-map-toolbar">
          <div class="global-map-identity"><Globe :size="20" /><strong>{{ c.selected.name }}</strong><small v-if="c.selected.current">Текущая</small></div>
          <div class="global-map-tools">
            <ActionButton :variant="addMode ? 'primary' : 'secondary'" :disabled="c.conflict || !route" @click="startAdding"><template #icon><MapPinPlus :size="16" /></template>Точки</ActionButton>
            <ActionButton :variant="!addMode ? 'primary' : 'secondary'" @click="addMode = false"><template #icon><Hand :size="16" /></template>Обзор</ActionButton>
            <ToggleSwitch v-model="labels" label="Подписи" />
            <ActionButton variant="quiet" icon-only aria-label="Уменьшить глобальную карту" @click="canvas?.zoom(.8)"><template #icon><Minus :size="16" /></template></ActionButton>
            <ActionButton variant="quiet" icon-only aria-label="Вписать глобальную карту" @click="canvas?.fit()"><template #icon><Scan :size="16" /></template></ActionButton>
            <ActionButton variant="quiet" icon-only aria-label="Увеличить глобальную карту" @click="canvas?.zoom(1.25)"><template #icon><Plus :size="16" /></template></ActionButton>
          </div>
          <span class="global-map-status" role="status">{{ c.saving ? 'Сохраняем…' : c.hasPending() ? 'Есть несохранённые изменения' : 'Сохранено' }}</span>
        </header>
        <p v-if="addMode && route" class="global-map-instruction">{{ route.name }} · нажмите на изображение, чтобы добавить точку</p>
        <GlobalMapPointInspector v-if="point && route && (!mobile || !addMode)" :point="point" :route="route" :index="route.points.indexOf(point)" :chapters="chapters"
          :disabled="c.conflict || c.busy" @close="pointId = ''" @change="patchPoint" @reorder="reorder" @delete="requestPointDelete(route.id, point.id)" />
      </template>
      <div v-else class="global-map-empty"><Globe :size="56" :stroke-width="1.2" /><h2>Путь вашей истории</h2><p>Загрузите карту мира, региона или города слева.<br />Создавайте маршруты, отмечайте главы и оставляйте заметки прямо на карте.</p></div>
      <div v-if="c.error" class="global-map-error" role="alert">{{ c.error }}
        <ActionButton variant="quiet" :disabled="c.saving || c.busy" @click="c.conflict ? reloadConfirm = true : retry()">{{ c.conflict ? 'Загрузить с сервера' : 'Повторить' }}</ActionButton>
      </div>
    </div>
    <ConfirmDialog v-if="pending" :title="pending.kind === 'map' ? 'Удалить глобальную карту?' : pending.kind === 'route' ? 'Удалить маршрут?' : 'Удалить точку?'"
      :message="pending.kind === 'map' ? 'Из сессии удалятся карта, её маршруты, точки и заметки.' : pending.kind === 'route' ? 'Маршрут будет удалён вместе с его точками и заметками.' : 'Точка и её заметка будут удалены, линия соединит соседние точки.'"
      confirm-label="Удалить" :loading="c.busy" @cancel="pending = null" @confirm="remove" />
    <ConfirmDialog v-if="reloadConfirm" title="Загрузить состояние с сервера?" message="Локальные несохранённые изменения будут отменены." confirm-label="Загрузить" @cancel="reloadConfirm = false" @confirm="reload" />
    <ConfirmDialog v-if="leaveConfirm" title="Изменения карты не сохранены" message="Можно остаться и повторить сохранение или уйти без этих изменений." confirm-label="Уйти без сохранения" cancel-label="Остаться" @cancel="finishLeave(false)" @confirm="finishLeave(true)" />
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ActionButton, ConfirmDialog, LoadingState, ToggleSwitch, useIsMobile } from '@sylvieshare/share-ui'
import { Globe, Hand, MapPinPlus, Minus, Plus, Scan } from '@lucide/vue'
import { useGlobalMaps } from '../composables/useGlobalMaps'
import { movePoint, ROUTE_COLORS, uid } from '../lib/routes'
import GlobalMapSidebar from './GlobalMapSidebar.vue'
import GlobalMapCanvas from './GlobalMapCanvas.vue'
import GlobalMapPointInspector from './GlobalMapPointInspector.vue'
const props = defineProps({ sessionUuid: { type: String, required: true }, participants: { type: Array, default: () => [] }, chapters: { type: Array, default: () => [] } })
const emit = defineEmits(['open-chapter'])
const c = reactive(useGlobalMaps(props.sessionUuid))
const sidebar = ref(null), canvas = ref(null), routeId = ref(''), pointId = ref(''), addMode = ref(false), labels = ref(true)
const pending = ref(null), reloadConfirm = ref(false), leaveConfirm = ref(false), mobile = useIsMobile(760)
const route = computed(() => c.selected?.routes.find(route => route.id === routeId.value))
const point = computed(() => route.value?.points.find(point => point.id === pointId.value))
watch(() => c.selectedId, () => { routeId.value = c.selected?.routes[0]?.id || ''; pointId.value = ''; addMode.value = false })
function addRoute() {
  const id = uid(), count = c.selected.routes.length
  c.change(map => map.routes.push({ id, name: `Маршрут ${count + 1}`, color: ROUTE_COLORS[count % ROUTE_COLORS.length], playerIds: [], points: [] }))
  routeId.value = id; pointId.value = ''; startAdding()
}
function selectRoute(id) { routeId.value = id; pointId.value = ''; addMode.value = false }
function select(id, point) { routeId.value = id; pointId.value = point; addMode.value = false }
function selectPoint(id) { pointId.value = id; const p = point.value; if (p) canvas.value?.focusPoint(p); if (mobile.value) sidebar.value?.collapse() }
function changeRoute(patch) { c.change(() => Object.assign(route.value, patch)) }
function startAdding() { if (!route.value) return; addMode.value = true; pointId.value = ''; if (mobile.value) sidebar.value?.collapse() }
function addPoint(position) {
  if (!route.value) return
  if (c.selected.routes.reduce((sum, route) => sum + route.points.length, 0) >= 1000) { c.error = 'На карте допускается до 1000 точек'; return }
  const id = uid()
  c.change(() => route.value.points.push({ id, ...position, name: '', note: '', chapterId: null }))
  pointId.value = id
}
function move(id, pointId, position) { const p = c.selected?.routes.find(route => route.id === id)?.points.find(p => p.id === pointId); if (p) Object.assign(p, position) }
function endDrag(changed) { c.editing = false; if (changed) c.persist() }
function patchPoint(patch) { c.change(() => Object.assign(point.value, patch)) }
function reorder(delta) { c.change(() => movePoint(route.value, pointId.value, delta)) }
function requestPointDelete(routeId, pointId) { pending.value = { kind: 'point', routeId, pointId } }
async function remove() {
  const target = pending.value
  if (target.kind === 'map') { if (!(await c.remove(target.item.id))) return }
  else if (target.kind === 'route') {
    c.change(map => { map.routes = map.routes.filter(route => route.id !== target.item.id) })
    if (routeId.value === target.item.id) { routeId.value = c.selected.routes[0]?.id || ''; pointId.value = ''; addMode.value = false }
  } else c.change(map => { const r = map.routes.find(route => route.id === target.routeId); if (r) r.points = r.points.filter(point => point.id !== target.pointId); pointId.value = '' })
  pending.value = null
}
function retry() { if (c.hasPending()) c.flush(); else c.load().catch(() => {}) }
async function reload() { reloadConfirm.value = false; await c.load(true).catch(() => {}); routeId.value = c.selected?.routes[0]?.id || ''; pointId.value = ''; addMode.value = false }
let resolveLeave
async function prepareLeave() { await c.flush(); if (!c.hasPending()) return true; leaveConfirm.value = true; return new Promise(resolve => { resolveLeave = resolve }) }
function finishLeave(leave) { leaveConfirm.value = false; resolveLeave?.(leave) }
defineExpose({ prepareLeave })
</script>
<style scoped src="../styles/globalMapWorkspace.css"></style>
