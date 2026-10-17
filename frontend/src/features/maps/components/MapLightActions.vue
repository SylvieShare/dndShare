<template>
  <div
    class="map-light-actions"
    role="group"
    :aria-label="
      primary ? 'Действия источника света' : 'Эффекты источника света'
    "
  >
    <template v-if="primary">
      <IconToggleButton
        :model-value="light.enabled"
        :color="light.color"
        :label="light.enabled ? 'Выключить свет' : 'Включить свет'"
        @update:model-value="change('enabled', $event)"
        ><template #icon><Lightbulb /></template
      ></IconToggleButton>
      <IconToggleButton
        :model-value="light.showMarker"
        :color="light.color"
        :label="
          light.showMarker
            ? 'Скрыть сферу источника'
            : 'Показать сферу источника'
        "
        @update:model-value="change('showMarker', $event)"
        ><template #icon><Eye /></template
      ></IconToggleButton>
      <ColorPresetPicker
        :model-value="light.color"
        :colors="colours"
        allow-custom
        aria-label="Цвет источника света"
        custom-label="Свой цвет света"
        @update:model-value="editor.updateLight(light.id, 'color', $event)"
      />
    </template>
    <template v-else>
      <IconToggleButton
        :model-value="light.flicker"
        :color="light.color"
        :label="light.flicker ? 'Выключить мерцание' : 'Включить мерцание'"
        @update:model-value="change('flicker', $event)"
        ><template #icon><Sparkles /></template
      ></IconToggleButton>
      <IconToggleButton
        :model-value="light.shadows"
        :color="light.color"
        :label="light.shadows ? 'Выключить тени' : 'Включить тени'"
        @update:model-value="change('shadows', $event)"
        ><template #icon><MapShadowIcon /></template
      ></IconToggleButton>
    </template>
  </div>
</template>
<script setup>
import { ColorPresetPicker, IconToggleButton } from "@sylvieshare/share-ui";
import { Eye, Lightbulb, Sparkles } from "@lucide/vue";
import MapShadowIcon from "./MapShadowIcon.vue";
const props = defineProps({ editor: Object, light: Object, primary: Boolean });
const colours = [
  "#ffc36a",
  "#ffd899",
  "#ff8c63",
  "#a98aff",
  "#68cfff",
  "#75e6ac",
  "#ffffff",
  "#ff6f9f",
];
function change(field, value) {
  props.editor.finishLightEdit();
  props.editor.updateLight(props.light.id, field, value);
  props.editor.finishLightEdit();
}
</script>
<style scoped>
.map-light-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
