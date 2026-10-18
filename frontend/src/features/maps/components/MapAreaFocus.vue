<template>
  <MapSelectedEntity :entry="areaEntry" :editor="editor" :copyable="false">
    <template #preview
      ><MapAreaPreview :editor="editor" :area="area"
    /></template>
    <div class="map-area-actions" role="group" aria-label="Отображение области">
      <ColorPresetPicker
        variant="button"
        :model-value="area.color || DEFAULT_AREA_COLOR"
        :colors="colours"
        allow-custom
        aria-label="Цвет области"
        custom-label="Свой цвет области"
        @update:model-value="editor.setAreaColor(area.id, $event)"
      />
      <IconToggleButton
        :model-value="!area.hidden"
        :color="area.color"
        :label="`${area.hidden ? 'Показать' : 'Скрыть'} область «${area.name}»`"
        @update:model-value="editor.setAreaHidden(area.id, !$event)"
        ><template #icon><Eye /></template
      ></IconToggleButton>
      <IconToggleButton
        :model-value="!!area.fog"
        :color="area.color"
        :label="`${area.fog ? 'Убрать туман с области' : 'Покрыть туманом область'} «${area.name}»`"
        @update:model-value="editor.setAreaFog(area.id, $event)"
        ><template #icon><CloudFog /></template
      ></IconToggleButton>
    </div>
    <MapInspectorSection :title="`Элементы области (${entries.length})`">
      <div class="map-area-members">
        <MapEntityRow
          v-for="entry in entries"
          :key="`${entry.kind}:${entry.id}`"
          :entry="entry"
          @select="emit('focus', [entry])"
        >
          <template v-if="entry.kind !== 'light'" #actions>
            <ActionButton
              icon-only
              variant="quiet"
              :aria-label="`Убрать ${entry.name} из области`"
              @click.stop="
                editor.removeAreaMember(area.id, entry.kind, entry.id)
              "
              ><template #icon><Minus :size="16" /></template
            ></ActionButton>
          </template>
        </MapEntityRow>
        <p v-if="!entries.length" class="map-hint">
          Область пуста. Выберите элементы на карте и добавьте их через блок
          «Область».
        </p>
      </div>
    </MapInspectorSection>
  </MapSelectedEntity>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  ColorPresetPicker,
  IconToggleButton,
} from "@sylvieshare/share-ui";
import { CloudFog, Eye, Minus } from "@lucide/vue";
import { DEFAULT_AREA_COLOR } from "../lib/mapAreas";
import { areaMapEntities } from "../lib/editorEntities";
import MapAreaPreview from "./MapAreaPreview.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, area: Object });
const emit = defineEmits(["focus"]);
const areaEntry = computed(() => ({
  kind: "area",
  id: props.area.id,
  name: props.area.name,
  color: props.area.color || DEFAULT_AREA_COLOR,
  item: props.area,
}));
const entries = computed(() => areaMapEntities(props.editor, props.area));
const colours = [
  "#8b5cf6",
  "#4f9cf9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
</script>
<style scoped>
.map-area-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.map-area-members {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
