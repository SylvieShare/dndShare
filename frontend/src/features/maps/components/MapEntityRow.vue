<template>
  <BaseTile
    class="map-entity-row"
    :interactive="selectable"
    :framed="selected"
    :tint="selected"
    :color="entry.color"
    :role="selectable ? 'button' : undefined"
    :tabindex="selectable ? 0 : undefined"
    :aria-label="entry.name"
    @click="selectable && !hasSelectedText() && emit('select', entry)"
    @keydown.enter.self.prevent="selectable && emit('select', entry)"
    @keydown.space.self.prevent="selectable && emit('select', entry)"
  >
    <ActionButton
      v-if="entry.kind === 'light' && toggleLight"
      variant="secondary"
      icon-only
      :style="{ color: entry.color }"
      :aria-label="`${entry.enabled ? 'Выключить' : 'Включить'} свет: ${entry.name}`"
      :title="`${entry.enabled ? 'Выключить' : 'Включить'} свет: ${entry.name}`"
      :aria-pressed="!!entry.enabled"
      @click.stop="emit('toggle', entry.id)"
      @keydown.stop
    >
      <template #icon
        ><Lightbulb v-if="entry.enabled" :size="26" /><LightbulbOff
          v-else
          :size="26"
      /></template>
    </ActionButton>
    <span
      v-else
      class="map-entity-thumbnail"
      :style="{ color: entry.color }"
      aria-hidden="true"
    >
      <img
        v-if="entry.previewUrl"
        :src="entry.previewUrl"
        alt=""
        loading="lazy"
        draggable="false"
      />
      <component
        v-else
        :is="
          entry.kind === 'light'
            ? entry.enabled
              ? Lightbulb
              : LightbulbOff
            : entry.kind === 'area'
              ? Group
              : ['player', 'creature', 'marker'].includes(entry.kind)
                ? UserRound
                : Box
        "
        :size="28"
      />
    </span>
    <span class="map-entity-label">
      <strong
        >{{ entry.name
        }}<template v-if="entry.areaName">
          ({{ entry.areaName }})</template
        ></strong
      >
      <small v-if="entry.code">{{ entry.code }}</small>
      <slot name="details" />
    </span>
    <strong v-if="entry.count" class="map-entity-count"
      >×{{ entry.count }}</strong
    >
    <ActionButton
      v-if="entry.kind === 'light' && toggleShadows"
      variant="quiet"
      icon-only
      :aria-label="`${entry.item.shadows ? 'Выключить' : 'Включить'} тени: ${entry.name}`"
      :aria-pressed="!!entry.item.shadows"
      :title="
        shadowsDisabled
          ? entry.item.builtinKey
            ? 'Тени встроенного источника задаются в справочнике'
            : 'Тени доступны у двух локальных источников одновременно'
          : `${entry.item.shadows ? 'Выключить' : 'Включить'} тени`
      "
      :disabled="shadowsDisabled"
      @click.stop="emit('toggle-shadows', entry.id)"
      @keydown.stop
    >
      <template #icon><MapShadowIcon :off="!entry.item.shadows" /></template>
    </ActionButton>
    <slot name="actions" />
  </BaseTile>
</template>
<script setup>
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import MapShadowIcon from "./MapShadowIcon.vue";
import { hasSelectedText } from "../lib/textSelection";
import { Box, Group, Lightbulb, LightbulbOff, UserRound } from "@lucide/vue";
defineProps({
  entry: { type: Object, required: true },
  selected: Boolean,
  toggleLight: Boolean,
  toggleShadows: Boolean,
  shadowsDisabled: Boolean,
  selectable: { type: Boolean, default: true },
});
const emit = defineEmits(["select", "toggle", "toggle-shadows"]);
</script>
<style scoped>
.map-entity-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  min-width: 0;
}
.map-entity-thumbnail {
  width: 48px;
  height: 48px;
  flex: none;
  display: grid;
  place-items: center;
}
.map-entity-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.map-entity-label {
  user-select: text;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
}
.map-entity-label strong {
  font-size: 13px;
  line-height: 1.35;
}
.map-entity-label small {
  font: 11px var(--font-mono);
  color: var(--text-muted);
}
.map-entity-count {
  flex: none;
  font-size: 13px;
}
.map-entity-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
