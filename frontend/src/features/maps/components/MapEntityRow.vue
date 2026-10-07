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
    <span
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
    </span>
    <strong v-if="entry.count" class="map-entity-count"
      >×{{ entry.count }}</strong
    >
    <ToggleSwitch
      v-if="entry.kind === 'light' && toggleLight"
      :model-value="entry.enabled"
      :aria-label="entry.name"
      :disabled="toggleDisabled"
      @click.stop
      @keydown.stop
      @update:model-value="emit('toggle', entry.id)"
    />
    <slot name="actions" />
  </BaseTile>
</template>
<script setup>
import { BaseTile, ToggleSwitch } from "@sylvieshare/share-ui";
import { hasSelectedText } from "../lib/textSelection";
import { Box, Group, Lightbulb, LightbulbOff } from "@lucide/vue";
defineProps({
  entry: { type: Object, required: true },
  selected: Boolean,
  toggleLight: Boolean,
  toggleDisabled: Boolean,
  selectable: { type: Boolean, default: true },
});
const emit = defineEmits(["select", "toggle"]);
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
