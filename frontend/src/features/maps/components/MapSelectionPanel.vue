<template>
  <aside
    v-if="entries.length"
    class="map-selection-panel"
    aria-label="Выбранные элементы"
  >
    <BaseTile class="map-selection-content">
      <div
        v-if="editor.selectedTiles.length || editor.selectedObjects.length"
        class="map-selection-summary"
      >
        <span
          v-if="editor.selectedTiles.length"
          role="status"
          aria-label="Выбрано плиток"
          >Выбрано: {{ editor.selectedTiles.length }}</span
        >
        <span
          v-if="editor.selectedObjects.length"
          role="status"
          aria-label="Выбрано объектов"
          >Объектов: {{ editor.selectedObjects.length }}</span
        >
      </div>
      <template v-if="entries.length === 1">
        <MapEntityRow
          v-if="single.kind === 'light'"
          :entry="single"
          @select="emit('focus', [single])"
        />
        <template v-else>
          <img
            v-if="single.previewUrl"
            class="map-selection-preview"
            :src="single.previewUrl"
            alt=""
            draggable="false"
          />
          <h3>{{ single.name }}</h3>
          <strong v-if="single.code" class="map-selection-code">{{
            single.code
          }}</strong>
          <p
            v-if="single.sourceName && single.sourceName !== single.name"
            class="map-hint"
          >
            {{ single.sourceName }}
          </p>
        </template>
        <dl
          class="map-selection-coordinates"
          aria-label="Координаты выбранного элемента"
        >
          <dt>X</dt>
          <dd>{{ number(single.position.x) }}</dd>
          <dt>Y</dt>
          <dd>{{ number(single.position.y) }}</dd>
          <dt>Высота</dt>
          <dd>{{ number(single.position.elevation) }}</dd>
          <template v-if="single.kind !== 'light'"
            ><dt>Поворот</dt>
            <dd>{{ single.item.rotation }}°</dd></template
          >
        </dl>
        <MapLightFields
          v-if="single.kind === 'light'"
          :editor="editor"
          :light="single.item"
          @bind="emit('bind', $event)"
          @focus="emit('focus', [$event])"
        />
      </template>
      <template v-else>
        <h3>Выбрано: {{ entries.length }}</h3>
        <div class="map-selection-list">
          <MapEntityRow
            v-for="group in groups"
            :key="group.groupKey"
            :entry="group"
            @select="emit('focus', group.members)"
          />
        </div>
      </template>
      <MapSelectionActions :editor="editor" />
    </BaseTile>
  </aside>
</template>
<script setup>
import { computed } from "vue";
import { BaseTile } from "@sylvieshare/share-ui";
import { groupMapEntities, selectedMapEntities } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapLightFields from "./MapLightFields.vue";
import MapSelectionActions from "./MapSelectionActions.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["focus", "bind"]);
const entries = computed(() => selectedMapEntities(props.editor));
const groups = computed(() => groupMapEntities(entries.value));
const single = computed(() => entries.value[0]);
const format = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const number = (value) => format.format(value || 0);
</script>
<style scoped>
.map-selection-panel {
  position: absolute;
  z-index: 16;
  right: 12px;
  top: 12px;
  width: 300px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 100px);
  overflow: auto;
}
.map-selection-content {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.map-selection-summary {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.map-selection-panel h3 {
  margin: 0;
  font-size: 17px;
}
.map-selection-preview {
  width: 100%;
  height: 150px;
  object-fit: contain;
}
.map-selection-code {
  font: 13px var(--font-mono);
  color: var(--text-muted);
}
.map-selection-coordinates {
  display: grid;
  grid-template-columns: repeat(3, auto 1fr);
  gap: 6px;
  margin: 0;
  font-size: 12px;
}
.map-selection-coordinates dt {
  color: var(--text-muted);
}
.map-selection-coordinates dd {
  margin: 0;
}
.map-selection-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
@media (max-width: 760px) {
  .map-selection-panel {
    width: 230px;
    max-height: calc(100% - 100px);
  }
}
</style>
