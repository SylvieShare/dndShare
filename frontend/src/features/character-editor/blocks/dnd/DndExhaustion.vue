<template>
  <button v-if="isCompact" class="exh-compact" :class="{ 'exh-compact--on': level > 0 }" type="button" title="Истощение" @click="open">
    <span class="exh-compact-label">Истощение</span>
    <strong>{{ level }}</strong>
  </button>
  <BaseTile v-else class="exh-tile" :color="color" :strip="level > 0" interactive @click="open">
    <DndExhaustionView :level="level" :value-text="valueText" :active-effects="activeEffects" />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="color"
    :strip="level > 0"
    :min-view-width="220"
    @close="closeEditor"
  >
    <template #view>
      <div class="exh-face">
        <DndExhaustionView :level="level" :value-text="valueText" :active-effects="activeEffects" />
      </div>
    </template>

    <template #editor>
      <DndExhaustionEditor :value="data" @change="emitValue" />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import DndExhaustionEditor from '@/features/character-editor/blocks/dnd/components/DndExhaustionEditor'
import DndExhaustionView from '@/features/character-editor/blocks/dnd/components/DndExhaustionView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const normalized = computed(() => normalizeExhaustion(props.value))
const data = computed(() => normalized.value.data)
const effects = computed(() => normalized.value.effects)
const level = computed(() => normalized.value.level)
const activeEffects = computed(() => effects.value.slice(0, level.value))
const valueText = computed(() => (level.value > 0 ? `${level.value} ур.` : 'нет'))
const color = computed(() => (level.value > 0 ? 'var(--danger)' : 'var(--text-muted)'))
const isCompact = computed(() => props.block?.props?.variant === 'compact')

function closeEditor() { close() }
function emitValue(value) { emit('update:value', props.block.id, value) }
</script>

<style scoped>
.exh-tile {
  min-height: 42px;
  padding: 10px 12px 10px 14px;
}

.exh-compact {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  min-height: 32px;
  height: 32px;
  padding: 2px clamp(1px, 1vw, 5px);
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
}
.exh-compact-label { width: 100%; overflow: hidden; font-size: clamp(7.5px, 2.4vw, 9px); font-weight: 700; letter-spacing: 0.02em; text-align: center; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.exh-compact strong { color: var(--text-2); font-size: 15px; line-height: 1; }
.exh-compact--on { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.exh-compact--on strong { color: var(--danger); }

/* morph view (left column) — match the tile's top/left padding so it doesn't jump during the morph */
.exh-face { padding: 10px 14px; }
</style>
