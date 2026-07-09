<template>
  <!-- toolbar mini -->
  <div v-if="variant === 'mini'" class="cmini" :class="{ 'cmini-toggled': toggled }" @click="open">
    <span class="cmini-label">{{ miniLabel || label }}</span>
    <span class="cmini-value">
      <span v-if="pre" class="cmini-plus">{{ pre }}</span>{{ value }}<span v-if="unit" class="cmini-unit">{{ unit }}</span>
    </span>
  </div>

  <!-- desktop grid tile -->
  <BaseTile v-else-if="variant === 'tile'" ref="tileRef" class="util-tile" :color="color" :strip="toggled">
    <StatTileFace :label="label" :value="value" :pre="pre" :unit="unit" :icon="icon" :rollable="rollable" :color="color" @edit="openTile" @open="openTile" @roll="$emit('action')" />
  </BaseTile>

  <!-- any other variant (e.g. mobile default): block may override the look via the `tile` slot.
       `open` opens the morph editor; `action` fires the tile's primary action (roll / shield). -->
  <slot v-else name="tile" :open="open" :action="() => $emit('action')">
    <BaseTile ref="tileRef" class="util-tile" :color="color" :strip="toggled">
      <StatTileFace :label="label" :value="value" :pre="pre" :unit="unit" :icon="icon" :rollable="rollable" :color="color" @edit="openTile" @open="openTile" @roll="$emit('action')" />
    </BaseTile>
  </slot>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="color"
    :strip="false"
    :editor-width="editorWidth"
    :min-view-width="minViewWidth"
    @close="close"
  >
    <template #view="{ revealed }">
      <StatTileFace :label="label" :value="value" :pre="pre" :unit="unit" :icon="icon" :color="color" :edit-fade="revealed" />
    </template>
    <template #editor><slot name="editor" /></template>
  </MorphEditorShell>
</template>

<script setup>
// Shared shell for the small "label + value" sheet tiles (AC / initiative / speed / prof-bonus).
// Owns the three variants (mini / tile / default) and the click-to-morph editor. A block supplies its
// computed display (label/value/pre/unit/color) and an `editor` slot; the morph and chrome are here.
// Clicking the tile always opens the editor; `rollable` tiles show a dice button that emits `action`.
// The colored strip appears only while `toggled` (AC with its shield up), so resting tiles have no strip.
import { ref } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import StatTileFace from '@/features/character-editor/blocks/dnd/components/StatTileFace'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

defineProps({
  variant: { type: String, default: '' },
  label: { type: String, default: '' },
  miniLabel: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  pre: { type: String, default: '' },
  unit: { type: String, default: '' },
  icon: { type: String, default: '' },
  color: { type: String, default: 'var(--accent)' },
  toggled: { type: Boolean, default: false },   // strip + mini accent (e.g. AC with shield up)
  rollable: { type: Boolean, default: false },   // show the dice button on the tile face
  editorWidth: { type: Number, default: 320 },
  minViewWidth: { type: Number, default: 150 },
})
defineEmits(['action'])

const tileRef = ref(null)
const { editorOpen, originRect, originEl, open, openFrom, close } = useMorphOrigin()

function openTile() { openFrom(tileRef.value?.$el || null) }
</script>

<style scoped>
.util-tile { width: 100%; min-width: 0; }

.cmini {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 40px;
  padding: 4px 6px;
  user-select: none;
  box-sizing: border-box;
  cursor: pointer;
}
.cmini:hover .cmini-value { color: #fff; }
.cmini-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmini-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  transition: color 0.15s;
}
.cmini-plus { font-size: 13px; font-weight: 700; color: var(--text-2); margin-right: 1px; }
.cmini-unit { font-size: 10px; font-weight: 500; color: var(--text-muted); }
.cmini-toggled .cmini-value { color: var(--accent); }
.cmini-toggled .cmini-label { color: color-mix(in srgb, var(--accent) 70%, var(--text-muted)); }
</style>
