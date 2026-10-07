<template>
  <aside
    v-if="area || entries.length"
    class="map-selection-panel"
    aria-label="Выбранные элементы"
  >
    <BaseTile class="map-selection-content">
      <MapAreaFocus
        v-if="area"
        :key="area.id"
        :editor="editor"
        :area="area"
        @focus="emit('focus', $event)"
      />
      <template v-else>
        <div v-if="entries.length > 1" class="map-selection-summary">
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
          <MapSelectedEntity :entry="single" :editor="editor" />
          <MapSelectionActions
            :editor="editor"
            :entry="single"
            @area="emit('area', $event)"
          />
          <MapLightFields
            v-if="single.kind === 'light'"
            :editor="editor"
            :light="single.item"
            @bind="emit('bind', $event)"
            @focus="emit('focus', [$event])"
          />
          <template v-else>
            <MapModelTransitions :editor="editor" :entry="single" />
            <MapModelLights :editor="editor" :entry="single" />
          </template>
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
        <MapSelectionActions
          v-if="entries.length > 1"
          :editor="editor"
          @area="emit('area', $event)"
        />
      </template>
    </BaseTile>
  </aside>
</template>
<script setup>
import { computed } from "vue";
import { BaseTile } from "@sylvieshare/share-ui";
import { groupMapEntities, selectedMapEntities } from "../lib/editorEntities";
import MapAreaFocus from "./MapAreaFocus.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapLightFields from "./MapLightFields.vue";
import MapSelectionActions from "./MapSelectionActions.vue";
import MapModelTransitions from "./MapModelTransitions.vue";
import MapModelLights from "./MapModelLights.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["focus", "bind", "area"]);
const area = computed(() =>
  props.editor.draft.document.areas.find(
    (a) => a.id === props.editor.focusedArea,
  ),
);
const entries = computed(() => selectedMapEntities(props.editor));
const groups = computed(() => groupMapEntities(entries.value));
const single = computed(() => entries.value[0]);
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
  user-select: text;
}
.map-selection-content {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.map-selection-panel h3 {
  margin: 0;
  font-size: 17px;
}
.map-selection-summary {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
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
