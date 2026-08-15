<template>
  <BaseTile v-if="!isCompact" :color="barColor" framed interactive @click="open">
    <DndHpView :hp="hp" @change="onHpChange" />
  </BaseTile>
  <DndHpView v-else compact :hp="hp" @open="open" @change="onHpChange" />

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :strip="false"
    orientation="vertical"
    :frame="barColor"
    @close="close"
  >
    <template #view>
      <DndHpView :hp="hp" @change="onHpChange" />
    </template>
    <template #editor>
      <DndHpEditor :hp="hp" @change="onHpChange" />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndHpEditor from '@/features/character-editor/blocks/dnd/components/DndHpEditor'
import DndHpView from '@/features/character-editor/blocks/dnd/components/DndHpView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { normalizeHitDice, withHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const isCompact = computed(() => props.block?.props?.variant === 'compact')
const hp = computed(() => {
  const raw = { max: 0, current: 0, temp: 0, hitDice: [], ds_success: 0, ds_failure: 0, ...props.value }
  return withHitDice(raw, normalizeHitDice(raw))
})

const barPct = computed(() => {
  const max = parseInt(hp.value.max) || 0
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, ((parseInt(hp.value.current) || 0) / max) * 100))
})
const barColor = computed(() => {
  const p = barPct.value
  if (p > 60) return 'var(--success)'
  if (p > 25) return 'var(--warning)'
  return 'var(--danger)'
})

function onHpChange(h) {
  emit('update:value', props.block.id, withHitDice(h, normalizeHitDice(h)))
}
</script>
