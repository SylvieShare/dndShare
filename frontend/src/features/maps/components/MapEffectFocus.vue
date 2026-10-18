<template>
  <MapSelectedEntity
    :entry="entry"
    :editor="editor"
    :removable="!entry.item.builtinKey"
  >
    <template #preview
      ><Flame :size="64" :style="{ color: entry.item.color }"
    /></template>
    <ToggleSwitch
      :model-value="entry.item.enabled"
      label="Показывать эффект"
      @update:model-value="editor.updateEffect(entry.id, 'enabled', $event)"
    />
    <MapInspectorSection title="Внешний вид огня">
      <ColorPresetPicker
        variant="button"
        :model-value="entry.item.color"
        allow-custom
        custom-label="Цвет огня"
        aria-label="Цвет огня"
        @update:model-value="editor.updateEffect(entry.id, 'color', $event)"
      />
      <FormField
        v-for="(label, index) in ['Ширина огня', 'Высота огня']"
        :key="label"
        :label="`${label}: ${entry.item.size[index]}`"
        vertical
      >
        <AppSlider
          :model-value="entry.item.size[index]"
          :label="label"
          :min="0.02"
          :max="index === 0 ? 4 : 8"
          :step="0.01"
          @update:model-value="size(index, $event)"
          @change="editor.finishComponentEdit"
        />
      </FormField>
      <FormField :label="`Сила колебаний: ${entry.item.strength}`" vertical
        ><AppSlider
          :model-value="entry.item.strength"
          label="Сила колебаний огня"
          :min="0"
          :max="2"
          :step="0.05"
          @update:model-value="
            editor.updateEffect(entry.id, 'strength', $event)
          "
          @change="editor.finishComponentEdit"
      /></FormField>
      <FormField :label="`Смещение по высоте: ${entry.item.height}`" vertical
        ><AppSlider
          :model-value="entry.item.height"
          label="Смещение эффекта по высоте"
          :min="0"
          :max="16"
          :step="0.05"
          @update:model-value="editor.updateEffect(entry.id, 'height', $event)"
          @change="editor.finishComponentEdit"
      /></FormField>
      <p class="map-hint">
        Анимация — 12 FPS. Яркость и радиус освещения настраиваются у источника
        света.
      </p>
    </MapInspectorSection>
    <MapFlagBinding
      :editor="editor"
      kind="effect"
      :item="entry.item"
      @focus="emit('focus', $event)"
    />
    <MapInspectorSection title="Привязка">
      <MapEntityRow
        v-if="owner"
        :entry="owner"
        @select="emit('focus', [$event])"
      />
      <template v-if="!entry.item.builtinKey">
        <ActionButton
          variant="secondary"
          @click="editor.beginEffectBinding(entry.id)"
          >Привязать к модели</ActionButton
        >
        <ActionButton
          v-if="entry.item.anchor"
          variant="quiet"
          @click="editor.bindEffect(entry.id, null)"
          >Отвязать</ActionButton
        >
        <p v-if="editor.bindingEffect === entry.id" class="map-hint">
          Нажмите на плитку или объект.
        </p>
      </template>
      <FormField v-if="!entry.item.anchor" label="Область" vertical
        ><FormSelect
          :value="entry.item.areaId || ''"
          aria-label="Область эффекта"
          @update:value="editor.updateEffect(entry.id, 'areaId', $event)"
          ><option value="">Вне области</option>
          <option
            v-for="area in editor.draft.document.areas"
            :key="area.id"
            :value="area.id"
          >
            {{ area.name }}
          </option></FormSelect
        ></FormField
      >
    </MapInspectorSection>
  </MapSelectedEntity>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  AppSlider,
  ColorPresetPicker,
  FormField,
  FormSelect,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { Flame } from "@lucide/vue";
import { mapEntity } from "../lib/editorEntities";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapFlagBinding from "./MapFlagBinding.vue";
const props = defineProps({ editor: Object, entry: Object });
const emit = defineEmits(["focus"]);
const owner = computed(
  () =>
    props.entry.item.anchor &&
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      props.entry.item.anchor.kind,
      props.entry.item.anchor.id,
    ),
);
function size(index, value) {
  const next = [...props.entry.item.size];
  next[index] = value;
  props.editor.updateEffect(props.entry.id, "size", next);
}
</script>
