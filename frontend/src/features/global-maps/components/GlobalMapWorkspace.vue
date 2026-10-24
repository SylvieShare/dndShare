<template>
  <section class="global-map-workspace" :style="{ '--world-navigation-width': `${navigationWidth}px`, '--world-panel-inset': `${Math.max(0, sidebarWidth - navigationWidth)}px` }" data-tutorial="session-global-map">
    <GlobalMapSidebar ref="sidebar" :controller="c" :selected-route="routeId"
      @add-route="addRoute" @select-route="selectRoute" @navigation-width="navigationWidth = $event" @sidebar-width="sidebarWidth = $event"
      @delete-map="map => pending = { kind: 'map', item: map }" @delete-route="route => pending = { kind: 'route', item: route }" />
    <div class="global-map-main">
      <LoadingState v-if="c.loading" label="Открываем мир…" fill />
      <template v-else-if="c.selected">
        <GlobalMapCanvas :key="c.selected.id" ref="canvas" :image-url="c.selected.imageUrl" :routes="c.selected.routes"
          :chapters="chapters" :locations="locations" :participants="participants" :selected-route="routeId" :selected-point="pointId"
          :readonly="c.conflict || c.busy" :add-mode="addMode && !!route"
          @select="select" @add="addPoint" @move="move" @drag-start="c.editing = true" @drag-end="endDrag" @insert-control="insertControl" @cancel-control="cancelControl" @continuation-active="continuing = $event"
          @remove-point="requestPointDelete" @chapter="emit('open-chapter', $event)" @location="emit('open-location', $event)" @cancel-add="addMode = false" />
        <WorkspaceControlsHint class="global-map-controls-hint" :lines="hintLines" :initially-collapsed="mobile" label="Управление миром" commands-label="Команды управления миром">
          <template v-if="addMode && route" #actions><span>{{ route.name }}</span><ActionButton variant="quiet" @click="addMode = false; selectRoute(routeId)">Готово</ActionButton></template>
        </WorkspaceControlsHint>
        <WorkspaceCanvasControls class="global-map-zoom" zoom-out-label="Уменьшить карту мира" fit-label="Вписать карту мира" zoom-in-label="Увеличить карту мира"
          @zoom="canvas?.zoom($event)" @fit="canvas?.fit()" />
        <GlobalMapPointInspector :visible="!routeFocus && !addMode && !continuing" :point="point" :route="inspectorRoute" :routes="c.selected.routes" :image-url="c.selected.imageUrl" :viewport="canvas?.viewport" :index="index" :chapters="chapters" :locations="locations"
          :disabled="c.conflict || c.busy" @dismiss="pointId = ''" @change="patchPoint" @route="selectRoute(routeId)" @delete="requestPointDelete(route.id, point.id)" @chapter="emit('open-chapter', $event)" @location="emit('open-location', $event)" />
        <GlobalMapRouteInspector :visible="routeFocus && !addMode && !continuing" :route="route" :routes="c.selected.routes" :chapters="chapters" :disabled="c.conflict || c.busy" @dismiss="routeFocus = false"
          @change="changeRoute" @reorder="reorder" @select-point="selectPoint" @delete-point="requestPointDelete(routeId, $event)" @add-mode="startAdding" />
      </template>
      <div v-else class="global-map-empty"><Globe :size="56" :stroke-width="1.2" /><h2>Путь вашей истории</h2><p>Загрузите карту мира, региона или города слева.<br />Создавайте маршруты, отмечайте главы и оставляйте заметки прямо на карте.</p></div>
      <div v-if="c.error" class="global-map-error" role="alert">{{ c.error }}
        <ActionButton variant="quiet" :disabled="c.saving || c.busy" @click="c.conflict ? reloadConfirm = true : retry()">{{ c.conflict ? 'Загрузить с сервера' : 'Повторить' }}</ActionButton>
      </div>
    </div>
    <ConfirmDialog v-if="pending" :title="pending.kind === 'map' ? 'Удалить карту мира?' : pending.kind === 'route' ? 'Удалить маршрут?' : 'Удалить точку?'"
      :message="pending.kind === 'map' ? 'Из сессии удалятся карта, её маршруты, точки и заметки.' : pending.kind === 'route' ? 'Маршрут будет удалён. Общие точки сохранятся в других маршрутах.' : 'Посещение будет удалено из маршрута, линия соединит соседние точки. Если на эту точку есть другие ссылки, её заметка и положение сохранятся.'"
      confirm-label="Удалить" :loading="c.busy" @cancel="pending = null" @confirm="remove" />
    <ConfirmDialog v-if="reloadConfirm" title="Загрузить состояние с сервера?" message="Локальные несохранённые изменения будут отменены." confirm-label="Загрузить" @cancel="reloadConfirm = false" @confirm="reload" />
    <ConfirmDialog v-if="leaveConfirm" title="Изменения карты не сохранены" message="Можно остаться и повторить сохранение или уйти без этих изменений." confirm-label="Уйти без сохранения" cancel-label="Остаться" @cancel="finishLeave(false)" @confirm="finishLeave(true)" />
  </section>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import { ActionButton, ConfirmDialog, LoadingState, useIsMobile } from '@sylvieshare/share-ui'
import { Globe } from '@lucide/vue'
import { useGlobalMaps } from '../composables/useGlobalMaps'
import { useGlobalMapEditing } from '../composables/useGlobalMapEditing'
import { pointIndex, resolvePoint } from '../lib/routePoints'
import GlobalMapSidebar from './GlobalMapSidebar.vue'
import GlobalMapCanvas from './GlobalMapCanvas.vue'
import GlobalMapRouteInspector from './GlobalMapRouteInspector.vue'
import GlobalMapPointInspector from './GlobalMapPointInspector.vue'
import WorkspaceControlsHint from '@/shared/ui/WorkspaceControlsHint.vue'
import WorkspaceCanvasControls from '@/shared/ui/WorkspaceCanvasControls.vue'
const props = defineProps({ sessionUuid: { type: String, required: true }, participants: { type: Array, default: () => [] }, chapters: { type: Array, default: () => [] }, locations: { type: Array, default: () => [] }, currentChapterId: Number })
const emit = defineEmits(['open-chapter', 'open-location'])
const c = reactive(useGlobalMaps(props.sessionUuid))
const sidebar = ref(null), canvas = ref(null), navigationWidth = ref(77), sidebarWidth = ref(77), continuing = ref(false)
const pending = ref(null), reloadConfirm = ref(false), leaveConfirm = ref(false), mobile = useIsMobile(760)
const { routeId, pointId, addMode, routeFocus, route, point, inspectorRoute, index, select, selectRoute, selectPoint, startAdding, addRoute, addPoint, move,
  insertControl, cancelControl, endDrag, patchPoint, reorder, deletePoint, deleteRoute } = useGlobalMapEditing(c, canvas, sidebar, mobile, props)
const hintLines = computed(() => [
  addMode.value ? 'Клик по карте — добавить точку' : 'Перенос фона — перемещение карты',
  'Колесо · + / − — масштаб',
  ...(route.value ? ['Cmd/Ctrl + клик — продолжить маршрут', 'Клик по точке с Cmd/Ctrl — повторное посещение'] : []),
  'Перенос маркера — переместить точку',
  'Потянуть линию — добавить узел изгиба',
  'Список маршрута — изменить порядок точек',
  'Delete — удалить выбранное',
  'Esc — отменить добавление или закрыть фокус',
])
function changeRoute(patch) { c.change(() => Object.assign(route.value, patch)) }
function requestPointDelete(routeId, pointId) {
  const entry = c.selected.routes.find(route => route.id === routeId)?.points.find(point => point.id === pointId)
  if (resolvePoint(entry, pointIndex(c.selected.routes))?.control) deletePoint(routeId, pointId)
  else pending.value = { kind: 'point', routeId, pointId }
}
async function remove() {
  const target = pending.value
  if (target.kind === 'map') { if (!(await c.remove(target.item.id))) return }
  else if (target.kind === 'route') deleteRoute(target.item.id)
  else deletePoint(target.routeId, target.pointId)
  pending.value = null
}
function retry() { if (c.hasPending()) c.flush(); else c.load(true).catch(() => {}) }
async function reload() { reloadConfirm.value = false; await c.load(true).catch(() => {}); routeId.value = c.selected?.routes[0]?.id || ''; pointId.value = ''; addMode.value = false }
let resolveLeave
async function prepareLeave() { await c.flush(); if (!c.hasPending()) return true; leaveConfirm.value = true; return new Promise(resolve => { resolveLeave = resolve }) }
function finishLeave(leave) { leaveConfirm.value = false; resolveLeave?.(leave) }
defineExpose({ prepareLeave })
</script>
<style scoped src="../styles/globalMapWorkspace.css"></style>
