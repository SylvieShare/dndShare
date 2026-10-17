<template>
  <aside
    ref="element"
    v-if="customFocus || area || entries.length"
    class="map-selection-panel"
    aria-label="Выбранные элементы"
  >
    <BaseTile class="map-selection-content">
      <slot v-if="customFocus" name="focus" />
      <MapAreaFocus
        v-else-if="area"
        :key="area.id"
        :editor="editor"
        :area="area"
        @focus="emit('focus', $event)"
      />
      <MapSelectedEntity
        v-else-if="entries.length === 1"
        :key="`${single.kind}:${single.id}`"
        :entry="single"
        :editor="editor"
      >
        <template v-if="single.kind === 'light'" #after-preview
          ><MapLightActions :editor="editor" :light="single.item" primary
        /></template>
        <MapLightFields
          v-if="single.kind === 'light'"
          :editor="editor"
          :light="single.item"
          @bind="emit('bind', $event)"
          @focus="emit('focus', [$event])"
        />
        <MapSelectionActions
          v-if="single.kind === 'light'"
          :editor="editor"
          :entry="single"
          @area="emit('area', $event)"
        />
        <template v-else>
          <MapSelectionActions
            :editor="editor"
            :entry="single"
            @area="emit('area', $event)"
          />
          <ToggleSwitch
            v-if="
              single.kind === 'object' &&
              !single.item.modelId &&
              interactive(single.item.kind)
            "
            :model-value="
              editor.draft.state?.objects[single.id] ?? single.item.open
            "
            label="Открыто"
            @update:model-value="
              editor.change((m) => {
                if (m.state) m.state.objects[single.id] = $event;
                else
                  m.document.objects.find((o) => o.id === single.id).open =
                    $event;
              })
            "
          />
          <MapModelTransitions :editor="editor" :entry="single" />
          <MapModelLights :editor="editor" :entry="single" />
        </template>
      </MapSelectedEntity>
      <MapFocusContent v-else>
        <template #heading
          ><h3>Выбрано: {{ entries.length }}</h3></template
        >
        <div class="map-selection-summary">
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
        <div class="map-selection-list">
          <MapEntityRow
            v-for="group in groups"
            :key="group.groupKey"
            :entry="group"
            @select="emit('focus', group.members)"
          />
        </div>
        <MapSelectionActions :editor="editor" @area="emit('area', $event)" />
      </MapFocusContent>
    </BaseTile>
  </aside>
</template>
<script setup>
import { interactive } from "../lib/mapModel";
import { computed, ref } from "vue";
import { BaseTile, ToggleSwitch } from "@sylvieshare/share-ui";
import { groupMapEntities, selectedMapEntities } from "../lib/editorEntities";
import MapFocusContent from "./MapFocusContent.vue";
import MapAreaFocus from "./MapAreaFocus.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapLightActions from "./MapLightActions.vue";
import MapLightFields from "./MapLightFields.vue";
import MapSelectionActions from "./MapSelectionActions.vue";
import MapModelTransitions from "./MapModelTransitions.vue";
import MapModelLights from "./MapModelLights.vue";
const element = ref(null);
defineExpose({ bounds: () => element.value?.getBoundingClientRect() });
const props = defineProps({ editor: Object, customFocus: Boolean });
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
  right: var(--map-focus-right, 12px);
  top: 12px;
  width: 300px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 100px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: text;
}
.map-selection-content {
  --map-panel-inset: 14px;
  padding: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
h3 {
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
  }
}
</style>
