<template>
  <DetailSection label="Точки маршрута">
    <div class="global-route-points">
      <div data-sortable-container="points" role="list" aria-label="Порядок точек маршрута">
        <BaseTile v-for="(point, index) in displayed" :key="point.id" framed class="global-route-point-row" :class="{ 'global-route-point-row--source': sortable.isSource(point) }" :data-sortable-key="point.id" role="listitem">
          <button type="button" class="global-route-point-handle" :disabled="disabled" :aria-label="`Переместить точку ${index + 1}: ${point.name || 'Точка маршрута'}`" @pointerdown="!disabled && sortable.startDrag($event, point, 'points', index)" @keydown="moveKey($event, point.id)"><GripVertical :size="16" /></button>
          <ActionButton variant="quiet" class="global-route-point-open" :aria-label="`${index + 1}. ${point.name || 'Точка маршрута'}`" @click="!sortable.suppressNextClick.value && emit('select-point', point.id)"><span class="global-route-point-number">{{ index + 1 }}</span><span>{{ point.name || chapters.find(chapter => chapter.id === point.chapterId)?.name || 'Точка маршрута' }}</span><FlagTriangleRight v-if="index === visits.length - 1" :size="14" aria-label="Последняя точка маршрута" /><Link2 v-if="point.sourceId !== point.id" :size="13" aria-label="Повторное посещение" /></ActionButton>
          <RemoveButton icon="trash" :label="`Удалить посещение ${index + 1}`" :disabled="disabled" @click="emit('delete-point', point.id)" />
        </BaseTile>
      </div>
      <AddButton block label="Добавить точку на карту" :disabled="disabled" @click="emit('add-mode')" />
    </div>
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, AddButton, BaseTile, DetailSection, RemoveButton, reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { FlagTriangleRight, GripVertical, Link2 } from '@lucide/vue'
import { routeVisits } from '../lib/routePoints'
const props = defineProps({ route: Object, routes: Array, chapters: Array, disabled: Boolean })
const emit = defineEmits(['reorder', 'select-point', 'delete-point', 'add-mode'])
const visits = computed(() => routeVisits(props.route, props.routes))
const sortable = useSortable({ groups: { points: { items: visits } }, getKey: point => point.id,
  onDrop: ({ fromIndex, toIndex }) => { if (!props.disabled && fromIndex !== toIndex) emit('reorder', reorderByDrop(visits.value, fromIndex, toIndex).map(point => point.id)) },
})
const displayed = computed(() => sortable.displayItems('points'))
function moveKey(event, id) {
  if (props.disabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const index = visits.value.findIndex(point => point.id === id), next = index + (event.key === 'ArrowUp' ? -1 : 1)
  if (next >= 0 && next < visits.value.length) emit('reorder', reorderByDrop(visits.value, index, next).map(point => point.id))
}
</script>
<style scoped>
.global-route-points { display: grid; gap: 9px; }
.global-route-point-row { display: flex; align-items: center; padding: 3px; margin-bottom: 5px; gap: 2px; }
.global-route-point-row--source { opacity: .3; }
.global-route-point-handle { display: grid; place-items: center; flex: none; width: 22px; height: 34px; padding: 0; border: 0; color: var(--text-muted); background: none; cursor: grab; touch-action: none; }
.global-route-point-handle:focus-visible { outline: 2px solid var(--accent); border-radius: 4px; }
.global-route-point-handle:disabled { opacity: .4; cursor: default; }
.global-route-point-open { flex: 1; min-width: 0; padding: 7px 4px; justify-content: flex-start; text-align: left; }
.global-route-point-open :deep(> span) { display: flex; flex: 1; align-items: center; min-width: 0; gap: 7px; overflow-wrap: anywhere; }
.global-route-point-open svg { flex: none; }
.global-route-point-number { flex: none; color: var(--accent-soft); font-variant-numeric: tabular-nums; }
</style>
