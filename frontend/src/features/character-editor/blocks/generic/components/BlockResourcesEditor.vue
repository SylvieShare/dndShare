<template>
  <EditorPanel compact>
    <EditorSection title="Ресурсы">
    <div v-if="resources.length" class="bre-list" data-sortable-container="resources">
      <div
        v-for="(row, idx) in displayRows"
        :key="row._id"
        class="bre-card"
        :class="{ 'sortable-placeholder': sortable.isSource(row) }"
        :data-sortable-key="row._id"
      >
        <span class="bre-strip" :style="{ background: row.color_point }"></span>
        <div class="bre-body">
        <div class="bre-top">
          <span
            v-if="resources.length > 1"
            class="drag-handle bre-drag"
            @pointerdown.stop="onDragStart($event, row, idx)"
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
              <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
              <circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/>
              <circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/>
            </svg>
          </span>
          <ColorPresetPicker :model-value="row.color_point" @update:model-value="v => $emit('change-color', row._id, v)" />
          <input
            class="bre-title-input"
            :value="row.title"
            :style="{ color: row.color_point }"
            placeholder="Название"
            @input="$emit('rename', row._id, $event.target.value)"
          />
          <FormNumberInput :value="row.total" :min="0" @change="v => $emit('set-total', row._id, v)" />
          <RemoveButton label="Удалить ресурс" @click="$emit('remove', row._id)" />
        </div>

        <div class="bre-rest">
          <ToggleSwitch
            :model-value="!!row.short_rest"
            label="Короткий отдых"
            @update:model-value="v => $emit('set-rest', row._id, 'short_rest', v)"
          />
          <ToggleSwitch
            :model-value="!!row.long_rest"
            label="Длинный отдых"
            @update:model-value="v => $emit('set-rest', row._id, 'long_rest', v)"
          />
        </div>
        </div>
      </div>
    </div>

    <AddButton block @click="$emit('add', '', DEFAULT_COLOR)">Ресурс</AddButton>
    </EditorSection>

    <EditorSection v-if="readonlyResources.length" title="Из листа">
      <div class="bre-readonly-list">
        <div v-for="row in readonlyResources" :key="row.key" class="bre-readonly-row">
          <span class="bre-strip" :style="{ background: row.color_point }"></span>
          <span class="bre-readonly-copy">
            <span class="bre-readonly-title">{{ row.title }}</span>
            <span class="bre-readonly-source">{{ row.source_label || 'Системный ресурс' }}</span>
          </span>
          <span class="bre-readonly-count">{{ row.value }} / {{ row.total }}</span>
          <span class="bre-lock" title="Редактируется в источнике">Только чтение</span>
        </div>
      </div>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import { AddButton } from '@sylvieshare/share-ui'
import { ColorPresetPicker } from '@sylvieshare/share-ui'
import { EditorPanel } from '@sylvieshare/share-ui'
import { EditorSection } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { RemoveButton } from '@sylvieshare/share-ui'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'

const DEFAULT_COLOR = '#c084fc'

const props = defineProps({
  resources: { type: Array, default: () => [] },
  readonlyResources: { type: Array, default: () => [] },
})
const emit = defineEmits(['reorder', 'change-color', 'rename', 'set-total', 'remove', 'add', 'set-rest'])

// `_id` = the resource's stored index; the array isn't mutated mid-drag, so it's a stable key for that drag.
const rows = computed(() => props.resources.map((r, i) => ({ ...r, _id: i })))

const sortable = useSortable({
  groups: {
    resources: { items: rows },
  },
  getKey: e => e._id,
  onDrop: ({ fromIndex, toIndex }) => {
    if (fromIndex === toIndex) return
    emit('reorder', reorderByDrop(props.resources, fromIndex, toIndex))
  },
})

const displayRows = computed(() => sortable.displayItems('resources'))

function onDragStart(e, row, idx) {
  sortable.startDrag(e, row, 'resources', idx)
}
</script>

<style scoped>
.bre-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.bre-card {
  display: flex;
  align-items: stretch;
  gap: 11px;
  padding: 16px 0;
  border-top: 2px solid var(--border);
}
.bre-card:first-child {
  padding-top: 2px;
  border-top: none;
}

.bre-strip {
  flex: 0 0 3px;
  border-radius: 3px;
  background: var(--text-muted);
}

.bre-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bre-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bre-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: grab;
  padding: 0 2px;
  flex-shrink: 0;
  touch-action: none;
  transition: color 0.12s;
}
.bre-drag:hover { color: var(--text-2); }
.bre-drag:active { cursor: grabbing; }

.sortable-placeholder {
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
}
.sortable-placeholder > * { visibility: hidden; }

.bre-title-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  outline: none;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: inherit;
  padding: 3px 0;
  min-width: 0;
  transition: border-color 0.15s;
}
.bre-title-input:focus { border-color: var(--accent); }
.bre-title-input::placeholder { color: var(--text-muted); font-weight: 400; text-transform: none; letter-spacing: 0; }

.bre-rest {
  display: flex;
  align-items: center;
  gap: 22px;
  padding-left: 26px;
}

.bre-readonly-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.bre-readonly-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}

.bre-readonly-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bre-readonly-title {
  overflow: hidden;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bre-readonly-source { color: var(--text-muted); font-size: 10px; }
.bre-readonly-count { color: var(--text-2); font-size: 12px; font-variant-numeric: tabular-nums; }
.bre-lock { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
</style>
