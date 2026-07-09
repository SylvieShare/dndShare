<template>
  <DndLvlView v-if="isCompact" compact :data="data" @open="open" />
  <DndLvlView v-else-if="isMini" mini :data="data" @open="open" />
  <BaseTile v-else class="lvl-tile" color="var(--accent)" interactive @click="open">
    <DndLvlView :data="data" />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :strip="false"
    orientation="vertical"
    @close="close"
  >
    <template #view><DndLvlView :data="data" /></template>
    <template #editor><DndLvlEditor :data="data" @change="onChange" /></template>
  </MorphEditorShell>
</template>

<script setup>
import { computed } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import DndLvlEditor from '@/features/character-editor/blocks/dnd/components/DndLvlEditor'
import DndLvlView from '@/features/character-editor/blocks/dnd/components/DndLvlView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const isCompact = computed(() => props.block?.props?.variant === 'compact')
const isMini = computed(() => props.block?.props?.variant === 'mini')
const data = computed(() => ({ level: 1, exp: 0, ...props.value }))

function onChange(d) { emit('update:value', props.block.id, d) }
</script>

<style scoped>
.lvl-tile { width: 100%; }
</style>
