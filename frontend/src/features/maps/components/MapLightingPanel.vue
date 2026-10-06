<template>
  <section class="map-lighting-panel" aria-label="Освещение карты">
    <FormField label="Режим освещения"
      ><CompactCheckbox
        :model-value="editor.draft.document.lightingEnabled"
        label="Режим освещения"
        @update:model-value="editor.updateLightingMode($event)"
    /></FormField>
    <p v-if="!editor.draft.document.lightingEnabled" class="map-hint">
      Сейчас используется прежний постоянный свет. Включите режим освещения,
      чтобы применять солнце и источники.
    </p>
    <MapSunSettings :editor="editor" />
    <DetailSection label="Источники света">
      <MapLightPresetMenu
        :disabled="editor.draft.document.lights.length >= 32"
        @place-light="(kind, event) => emit('place-light', kind, event)"
      />
      <p class="map-hint">
        Выберите пресет через плюс, затем поставьте источник на карту.
        Ctrl/Cmd+C и Ctrl/Cmd+V копируют выбранный источник.
      </p>
    </DetailSection>
    <ActionButton
      v-for="light in editor.draft.document.lights"
      :key="light.id"
      :variant="editor.selectedLight === light.id ? 'primary' : 'quiet'"
      @click="editor.selectLight(light.id)"
      ><Lightbulb :size="16" />{{ light.name
      }}{{ light.enabled ? "" : " · выключен" }}</ActionButton
    >
    <MapLightFields v-if="selected" :editor="editor" :light="selected" />
  </section>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  CompactCheckbox,
  DetailSection,
  FormField,
} from "@sylvieshare/share-ui";
import { Lightbulb } from "@lucide/vue";
import MapLightPresetMenu from "./MapLightPresetMenu.vue";
import MapSunSettings from "./MapSunSettings.vue";
import MapLightFields from "./MapLightFields.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["place-light"]);
const selected = computed(() =>
  props.editor.draft.document.lights.find(
    (l) => l.id === props.editor.activeLight,
  ),
);
</script>
<style scoped>
.map-lighting-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
