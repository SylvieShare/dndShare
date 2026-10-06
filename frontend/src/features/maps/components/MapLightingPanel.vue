<template>
  <section class="map-lighting-panel" aria-label="Освещение карты">
    <MapSunSettings :editor="editor" />
    <DetailSection label="Источники света">
      <p class="map-hint">
        Перетащите источник на карту. Его можно двигать мышкой или выбрать в
        списке.
      </p>
      <div class="map-light-presets">
        <BaseTile
          v-for="preset in presets"
          :key="preset.kind"
          interactive
          role="button"
          tabindex="0"
          :aria-label="preset.name"
          class="map-light-preset"
          @pointerdown="emit('drag-light', preset.kind, $event)"
          @keydown.enter.prevent="emit('place-light', preset.kind, $event)"
          @keydown.space.prevent="emit('place-light', preset.kind, $event)"
          ><component
            :is="icons[preset.kind]"
            :size="24"
            :style="{ color: preset.color }"
          /><span>{{ preset.name }}</span></BaseTile
        >
      </div>
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
import { ActionButton, BaseTile, DetailSection } from "@sylvieshare/share-ui";
import { Flame, Lightbulb, Sparkles } from "@lucide/vue";
import { LIGHT_PRESETS } from "../lib/mapLighting";
import MapSunSettings from "./MapSunSettings.vue";
import MapLightFields from "./MapLightFields.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["drag-light", "place-light"]);
const presets = LIGHT_PRESETS,
  icons = { torch: Flame, candle: Lightbulb, magic: Sparkles };
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
.map-light-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.map-light-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  font-size: 11px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
</style>
