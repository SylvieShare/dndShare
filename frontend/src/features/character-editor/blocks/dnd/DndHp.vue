<template>
  <BaseTile v-if="!isCompact" :color="barColor" framed interactive @click="open">
    <DndHpView :hp="hp" :dice-options="diceOptions" @change="onHpChange" />
  </BaseTile>
  <DndHpView v-else compact :hp="hp" :dice-options="diceOptions" @open="open" @change="onHpChange" />

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
      <DndHpView :hp="hp" :dice-options="diceOptions" @change="onHpChange" />
    </template>
    <template #editor>
      <DndHpEditor :hp="hp" :dice-options="diceOptions" @change="onHpChange" />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import DndHpEditor from '@/features/character-editor/blocks/dnd/components/DndHpEditor'
import DndHpView from '@/features/character-editor/blocks/dnd/components/DndHpView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12']

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const isCompact = computed(() => props.block?.props?.variant === 'compact')
const level = computed(() => {
  const lvl = props.values?.lvl
  const n = lvl && typeof lvl === 'object' ? (lvl.level ?? lvl.lvl ?? lvl.v) : lvl
  return Math.max(1, parseInt(n) || 1)
})
const hp = computed(() => ({ max: 0, current: 0, temp: 0, dice: 'd8', diceUsed: 0, ds_success: 0, ds_failure: 0, ...props.value, diceCount: level.value }))

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

const diceOptions = computed(() => {
  const typeId = props.block.content?.dice_suggest_type_id
  let opts
  if (typeId) {
    const items = useSuggestStore().items(typeId)
    if (items?.length) opts = items.map(s => ({ value: s.value || String(s.id), svg: s.svg || null }))
  }
  if (!opts) opts = DICE.map(d => ({ value: d, svg: null }))
  return opts.slice().sort((a, b) => (parseInt(a.value) || 0) - (parseInt(b.value) || 0))
})

onMounted(async () => {
  const typeId = props.block.content?.dice_suggest_type_id
  if (typeId) await useSuggestStore().ensure(typeId)
})

function onHpChange(h) {
  emit('update:value', props.block.id, h)
}
</script>
