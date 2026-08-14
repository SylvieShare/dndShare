<template>
  <div
    class="base-tile"
    :class="{ 'base-tile--interactive': interactive, 'base-tile--tint': tint, 'base-tile--framed': framed }"
    :style="{ '--tile-color': resolvedColor }"
    @click="$emit('click', $event)"
  >
    <span v-if="strip" class="base-tile-strip" />
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Accent color for the tile (drives the optional strip and hover tint).
  color: { type: String, default: null },
  // Show a colored vertical strip on the left edge.
  strip: { type: Boolean, default: false },
  // Faint always-on background tint in the tile color (a light accent).
  tint: { type: Boolean, default: false },
  // Gradient fill + colored border in the tile color (e.g. the HP block).
  framed: { type: Boolean, default: false },
  // Pointer cursor + hover tint.
  interactive: { type: Boolean, default: false },
})

defineEmits(['click'])

const resolvedColor = computed(() => props.color || 'var(--accent)')
</script>

<style scoped>
.base-tile {
  position: relative;
  background: var(--surface);
  border: none;
  border-radius: var(--r-lg);
  box-shadow: inset 0 0 0 1px var(--border);
  box-sizing: border-box;
  transition: background 0.15s, box-shadow 0.15s;
}

.base-tile--tint {
  background: color-mix(in srgb, var(--tile-color) 6%, var(--surface));
}

.base-tile--interactive {
  cursor: pointer;
}

.base-tile--interactive:hover {
  background: color-mix(in srgb, var(--tile-color) 11%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tile-color) 28%, var(--border));
}

/* gradient + colored border (HP block look) */
.base-tile--framed {
  background: linear-gradient(135deg, var(--surface) 50%, color-mix(in srgb, var(--tile-color) 6%, var(--surface)));
  box-shadow: none;
  transition: background 0.3s ease;
}
.base-tile--framed::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--tile-color) 35%, var(--border));
  border-radius: inherit;
  pointer-events: none;
  transition: border-color 0.3s ease;
  z-index: 2;
}
.base-tile--framed.base-tile--interactive:hover {
  background: linear-gradient(135deg, var(--surface) 50%, color-mix(in srgb, var(--tile-color) 8%, var(--surface)));
  box-shadow: none;
}
.base-tile--framed.base-tile--interactive:hover::before {
  border-color: color-mix(in srgb, var(--tile-color) 55%, var(--border));
}

.base-tile-strip {
  position: absolute;
  /* start after the corner curve and end before it, so the strip doesn't ride over the rounding */
  top: var(--r-lg);
  bottom: var(--r-lg);
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--tile-color);
}

</style>
