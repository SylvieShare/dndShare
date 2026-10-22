<template>
  <WorkspaceFocusPanel
    ref="panel"
    :open="!!(customFocus || editor.focusedCamera || area || entries.length)"
    :focus-key="focusKey"
    class="map-selection-panel"
    aria-label="Выбранные элементы"
  >
    <template #navigation
      ><MapFocusBack :entry="backEntry" @back="emit('back')"
    /></template>
    <slot v-if="customFocus" name="focus" />
    <MapCameraFocus
      v-else-if="editor.focusedCamera"
      :editor="editor"
      :camera="editor.focusedCamera"
    />
    <MapAreaFocus
      v-else-if="area"
      :editor="editor"
      :area="area"
      @focus="emit('focus', $event)"
    />
    <MapSelectedEntity
      v-else-if="entries.length === 1"
      :entry="single"
      :editor="editor"
    >
      <template v-if="single.kind === 'light'" #after-preview
        ><MapLightActions :editor="editor" :light="single.item" primary
      /></template>
      <MapDecalFields
        v-if="single.kind === 'decal'"
        :editor="editor"
        :decal="single.item"
        @focus="emit('focus', $event)"
      />
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
      <template v-else-if="single.kind !== 'decal'">
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
        <MapModelLights
          :editor="editor"
          :entry="single"
          @focus="emit('focus', $event)"
        />
      </template>
    </MapSelectedEntity>
    <MapFocusContent v-else>
      <template #heading
        ><MapEntityHeading
          :entry="{
            kind: 'group',
            name: `Выбрано: ${entries.length}`,
          }"
      /></template>
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
  </WorkspaceFocusPanel>
</template>
<script setup>
import MapCameraFocus from "./MapCameraFocus.vue";
import MapFocusBack from "./MapFocusBack.vue";
import WorkspaceFocusPanel from "@/shared/ui/WorkspaceFocusPanel.vue";
import { interactive } from "../lib/mapModel";
import { computed, ref } from "vue";
import { ToggleSwitch } from "@sylvieshare/share-ui";
import { groupMapEntities, selectedMapEntities } from "../lib/editorEntities";
import MapEntityHeading from "./MapEntityHeading.vue";
import MapFocusContent from "./MapFocusContent.vue";
import MapAreaFocus from "./MapAreaFocus.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapLightActions from "./MapLightActions.vue";
import MapDecalFields from "./MapDecalFields.vue";
import MapLightFields from "./MapLightFields.vue";
import MapSelectionActions from "./MapSelectionActions.vue";
import MapModelTransitions from "./MapModelTransitions.vue";
import MapModelLights from "./MapModelLights.vue";
const panel = ref(null);
defineExpose({ bounds: () => panel.value?.bounds() });
const props = defineProps({
  editor: Object,
  backEntry: Object,
  customFocus: Boolean,
  customFocusKey: String,
});
const emit = defineEmits(["focus", "bind", "area", "back"]);
const area = computed(() =>
  props.editor.draft.document.areas.find(
    (a) => a.id === props.editor.focusedArea,
  ),
);
const entries = computed(() => selectedMapEntities(props.editor));
const groups = computed(() => groupMapEntities(entries.value));
const single = computed(() => entries.value[0]);
const focusKey = computed(() =>
  props.customFocus
    ? `custom:${props.customFocusKey || "focus"}`
    : props.editor.focusedCamera
      ? `camera:${props.editor.focusedCamera.id}`
      : area.value
        ? `area:${area.value.id}`
        : entries.value.length === 1
          ? `${single.value.kind}:${single.value.id}`
          : "group",
);
</script>
<style scoped>
.map-selection-panel {
  --workspace-focus-right: var(--map-focus-right, 12px);
  --workspace-focus-left: var(--map-overlay-left, 0px);
  --inspector-inset: 14px;
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
</style>
