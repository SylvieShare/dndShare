<template>
  <BaseTile ref="tutorialHp" data-tutorial="character-hp" v-if="!isCompact" :color="barColor" framed :interactive="canEdit" @click="openEditor">
    <DndHpView :hp="hp" @change="onHpChange" />
  </BaseTile>
  <DndHpView ref="tutorialHp" data-tutorial="character-hp" v-else compact :hp="hp" @open="openEditor" @change="onHpChange" />

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
      <DndHpEditor data-tutorial="character-hp-editor" :hp="hp" @change="onHpChange" />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { useTutorialAction } from '@/features/tutorials/composables/useTutorialAction'
import { computed, inject, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import DndHpEditor from '@/features/character-editor/blocks/dnd/components/DndHpEditor'
import DndHpView from '@/features/character-editor/blocks/dnd/components/DndHpView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { normalizeHitDice, withHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { hpMaximum, normalizeHpMaximum } from '@/features/character-editor/blocks/dnd/lib/hp'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const canEdit = computed(() => !!charCtx.ownerMode)
const { editorOpen, originRect, originEl, open: openMorph, close } = useMorphOrigin()

const tutorialHp = ref(null)
useTutorialAction('character-health', ({ onCleanup }) => {
  const wasOpen = editorOpen.value
  onCleanup(() => { if (!wasOpen) close() })
  if (!wasOpen) openMorph({ currentTarget: tutorialHp.value?.rootElement?.() || tutorialHp.value?.$el })
})

const isCompact = computed(() => props.block?.props?.variant === 'compact')
const hp = computed(() => {
  const raw = { max: 0, current: 0, temp: 0, hitDice: [], ds_success: 0, ds_failure: 0, ...props.value }
  const maximum = normalizeHpMaximum(raw.max)
  const contributed = charCtx.characterHitPoints?.bonuses || []
  return withHitDice({ ...raw, max: { ...maximum, bonuses: [...maximum.bonuses, ...contributed] } }, normalizeHitDice(raw))
})

const barPct = computed(() => {
  const max = hpMaximum(hp.value)
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
  if (!canEdit.value) return
  const maximum = normalizeHpMaximum(h.max)
  const stored = { ...h, max: { ...maximum, bonuses: maximum.bonuses.filter((row) => !row?.source?.sourceId) } }
  emit('update:value', props.block.id, withHitDice(stored, normalizeHitDice(stored)))
}

function openEditor(event) {
  if (canEdit.value) openMorph(event)
}
</script>
