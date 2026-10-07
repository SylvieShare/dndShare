<template>
  <header class="map-selected-heading">
    <h3>{{ entry.name }}</h3>
    <small v-if="entry.code">{{ entry.groupCode }} · {{ entry.code }}</small>
  </header>
  <div class="map-selected-visual">
    <BaseTile class="map-selected-frame" framed>
      <img
        v-if="entry.previewUrl"
        class="map-selection-preview"
        :src="entry.previewUrl"
        alt=""
        draggable="false"
      />
      <component
        v-else
        :is="entry.kind === 'light' ? Lightbulb : Box"
        :size="64"
        :style="{ color: entry.color }"
      />
    </BaseTile>
    <div class="map-selected-buttons">
      <ActionButton
        icon-only
        variant="quiet"
        aria-label="Скопировать элемент"
        title="Скопировать элемент"
        @click="editor.copy()"
      >
        <template #icon><Copy :size="18" /></template>
      </ActionButton>
      <ActionButton
        v-if="!entry.item.builtinKey"
        icon-only
        variant="quiet"
        aria-label="Удалить элемент"
        title="Удалить элемент"
        @click="editor.removeSelected()"
      >
        <template #icon><Trash2 :size="18" /></template>
      </ActionButton>
    </div>
  </div>
  <table
    class="map-selection-coordinates"
    aria-label="Координаты выбранного элемента"
  >
    <thead>
      <tr>
        <th>X</th>
        <th>Y</th>
        <th>Z</th>
        <th v-if="entry.kind !== 'light'">Поворот</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{ number(entry.position.x) }}</td>
        <td>{{ number(entry.position.y) }}</td>
        <td>{{ number(entry.position.elevation) }}</td>
        <td v-if="entry.kind !== 'light'">{{ entry.item.rotation }}°</td>
      </tr>
    </tbody>
  </table>
</template>
<script setup>
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import { Box, Copy, Lightbulb, Trash2 } from "@lucide/vue";
defineProps({ entry: Object, editor: Object });
const format = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const number = (value) => format.format(value || 0);
</script>
<style scoped>
.map-selected-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
h3 {
  margin: 0;
  font-size: 17px;
}
small {
  font: 11px var(--font-mono);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.map-selected-visual {
  display: flex;
  gap: 8px;
}
.map-selected-frame {
  --surface: var(--map-model-preview-bg);
  flex: 1;
  min-width: 0;
  height: 150px;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.map-selection-preview {
  width: 100%;
  height: 150px;
  object-fit: contain;
}
.map-selected-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.map-selection-coordinates {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
  text-align: center;
}
th {
  color: var(--text-muted);
  font-weight: 500;
}
th,
td {
  padding: 6px 2px;
  border-bottom: 1px solid var(--border);
}
</style>
