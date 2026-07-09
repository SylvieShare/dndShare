<template>
  <EditorPanel compact>
    <EditorSection title="Способности">
    <div v-if="entries.length" class="abe-list" data-sortable-container="abilities">
      <div
        v-for="(entry, idx) in displayItems"
        :key="entry.id"
        class="abe-row"
        :class="{ 'sortable-placeholder': sortable.isSource(entry) }"
        :data-sortable-key="entry.id"
      >
        <span
          v-if="entries.length > 1"
          class="drag-handle abe-drag"
          @pointerdown.stop="onDragStart($event, entry, idx)"
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
            <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
            <circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/>
            <circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/>
          </svg>
        </span>

        <span class="abe-name">{{ entry.name }}</span>

        <div v-if="entry.manual_size" class="abe-uses" title="Количество ячеек">
          <button class="abe-step" type="button" @click="$emit('dec', entry)">−</button>
          <span class="abe-count">{{ entry.max_use || 0 }}</span>
          <button class="abe-step" type="button" @click="$emit('inc', entry)">+</button>
        </div>

        <button
          v-if="entry.isUserOwned"
          class="abe-edit"
          type="button"
          title="Редактировать"
          @click="$emit('edit', entry)"
        >✦</button>

        <RemoveButton label="Удалить способность" @click="$emit('remove', entry.id)" />
      </div>
    </div>
    <div v-else class="abe-empty">Способностей нет</div>

    <AddButton block @click="$emit('add')">Добавить способность…</AddButton>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'

import AddButton from '@/shared/ui/AddButton'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import RemoveButton from '@/shared/ui/RemoveButton'
import { reorderByDrop, useSortable } from '@/shared/composables/useSortable'

const props = defineProps({
  entries: { type: Array, default: () => [] },
})
const emit = defineEmits(['add', 'remove', 'inc', 'dec', 'edit', 'reorder'])

const sortable = useSortable({
  groups: {
    abilities: { items: computed(() => props.entries) },
  },
  getKey: e => e.id,
  onDrop: ({ fromIndex, toIndex }) => {
    if (fromIndex === toIndex) return
    emit('reorder', reorderByDrop(props.entries.map(e => e.id), fromIndex, toIndex))
  },
})

const displayItems = computed(() => sortable.displayItems('abilities'))

function onDragStart(e, entry, idx) {
  sortable.startDrag(e, entry, 'abilities', idx)
}
</script>

<style scoped>
.abe-list { display: flex; flex-direction: column; gap: 4px; }

.abe-empty { color: var(--text-muted); font-size: 13px; padding: 4px 2px; }

.abe-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 4px 4px 4px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: color-mix(in srgb, #fff 2%, var(--block-bg));
}

.abe-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: grab;
  padding: 0 4px;
  flex-shrink: 0;
  touch-action: none;
  transition: color 0.12s;
}
.abe-drag:hover { color: var(--text-2); }
.abe-drag:active { cursor: grabbing; }

.sortable-placeholder {
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
}
.sortable-placeholder > * { visibility: hidden; }

.abe-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-1);
}

.abe-uses {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.abe-step {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.12s, border-color 0.12s;
}
.abe-step:hover { color: var(--text-2); border-color: var(--text-muted); }

.abe-count {
  min-width: 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.abe-edit {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-attack);
  font-size: 12px;
  padding: 0 2px;
  cursor: pointer;
  line-height: 1;
  transition: color 0.15s;
}
.abe-edit:hover { color: var(--accent); }
</style>
