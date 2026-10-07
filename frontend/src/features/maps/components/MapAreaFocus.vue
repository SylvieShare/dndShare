<template>
  <header class="map-area-focus-heading">
    <Group :size="24" :style="{ color: area.color || DEFAULT_AREA_COLOR }" />
    <h3>{{ area.name }}</h3>
    <ActionButton
      icon-only
      variant="quiet"
      aria-label="Снять фокус области"
      @click="editor.clearAreaFocus(true)"
      ><template #icon><X :size="18" /></template
    ></ActionButton>
  </header>
  <FormField label="Название области" vertical>
    <FormTextInput
      v-model:value="name"
      aria-label="Название области"
      :maxlength="100"
      required
      @change="rename"
      @enter="rename"
    />
  </FormField>
  <FormField label="Цвет области" vertical>
    <ColorPresetPicker
      :model-value="area.color || DEFAULT_AREA_COLOR"
      :colors="colours"
      allow-custom
      aria-label="Цвет области"
      custom-label="Свой цвет области"
      @update:model-value="editor.setAreaColor(area.id, $event)"
    />
  </FormField>
  <ToggleSwitch
    :model-value="area.hidden"
    :label="`Скрыть область «${area.name}»`"
    @update:model-value="editor.setAreaHidden(area.id, $event)"
  />
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
            @click.stop="editor.removeAreaMember(area.id, entry.kind, entry.id)"
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
  <RemoveButton
    icon="trash"
    :label="`Удалить область «${area.name}»`"
    @click="editor.removeArea(area.id)"
  />
</template>
<script setup>
import { computed, ref, watch } from "vue";
import {
  ActionButton,
  ColorPresetPicker,
  FormField,
  FormTextInput,
  RemoveButton,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { Group, Minus, X } from "@lucide/vue";
import { DEFAULT_AREA_COLOR } from "../lib/mapAreas";
import { areaMapEntities } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object, area: Object });
const emit = defineEmits(["focus"]);
const name = ref(props.area.name);
watch(
  () => props.area.name,
  (value) => {
    name.value = value;
  },
);
function rename() {
  props.editor.renameArea(props.area.id, name.value);
  name.value = props.area.name;
}
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
.map-area-focus-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 17px;
  overflow-wrap: anywhere;
}
.map-area-members {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
