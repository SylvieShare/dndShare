<template>
  <div class="dc-block">
    <div v-if="counters.length || ownerMode" class="dc-row" data-sortable-container="counters">
      <DndCounterTile
        v-for="(c, i) in displayCounters"
        :key="c.id"
        :counter="c"
        :index="i"
      />
      <button v-if="ownerMode" class="dc-add" type="button" @click="add">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        плитка
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, provide, reactive, ref } from 'vue'
import DndCounterTile from '@/features/character-editor/blocks/dnd/components/DndCounterTile.vue'
import { useSortable, reorderByDrop } from '@/shared/composables/useSortable'
import {
  defaultCounter,
  normalizeCounters,
  patchCounter,
} from '@/features/character-editor/blocks/dnd/lib/counterEntry'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const counters = computed(() => normalizeCounters(props.value))
const ownerMode = computed(() => !!charCtx.ownerMode)
const justAddedId = ref(null)

function emitCounters(next) {
  emit('update:value', props.block.id, next)
}

const sortable = useSortable({
  groups: { counters: { items: counters } },
  getKey: c => c.id,
  onDrop: ({ fromIndex, toIndex }) => {
    if (fromIndex === toIndex) return
    emitCounters(reorderByDrop(counters.value, fromIndex, toIndex))
  },
})

const displayCounters = computed(() => sortable.displayItems('counters'))

function onDragStart(e, counter, index) {
  if (!ownerMode.value) return
  sortable.startDrag(e, counter, 'counters', index)
}

function adjust(id, delta) {
  if (!ownerMode.value) return
  emitCounters(counters.value.map(c => {
    if (c.id !== id) return c
    return patchCounter(c, { value: (c.value || 0) + delta })
  }))
}

function update(id, patch) {
  emitCounters(counters.value.map(c => (c.id === id ? patchCounter(c, patch) : c)))
}

function remove(id) {
  emitCounters(counters.value.filter(c => c.id !== id))
}

function add() {
  const c = defaultCounter()
  justAddedId.value = c.id
  emitCounters([...counters.value, c])
}

provide('countersBlockCtx', reactive({
  charCtx,
  ownerMode,
  sortable,
  onDragStart,
  adjust,
  update,
  remove,
  justAddedId,
  clearJustAdded: () => { justAddedId.value = null },
}))
</script>

<style scoped>
.dc-block { min-width: 0; }

.dc-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
}

.dc-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 86px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.dc-add:hover {
  color: var(--text-2);
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
</style>
