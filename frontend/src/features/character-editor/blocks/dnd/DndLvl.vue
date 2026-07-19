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
    <template #editor><DndLvlEditor :data="data" @change="onChange" @levelup="openLevelUp" /></template>
  </MorphEditorShell>

  <DndLevelUpModal
    v-if="levelUpOpen"
    :values="values"
    @apply="applyLevelUp"
    @close="levelUpOpen = false"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import DndLevelUpModal from '@/features/character-editor/blocks/dnd/components/DndLevelUpModal'
import DndLvlEditor from '@/features/character-editor/blocks/dnd/components/DndLvlEditor'
import DndLvlView from '@/features/character-editor/blocks/dnd/components/DndLvlView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const levelUpOpen = ref(false)

const isCompact = computed(() => props.block?.props?.variant === 'compact')
const isMini = computed(() => props.block?.props?.variant === 'mini')
const data = computed(() => ({ level: 1, exp: 0, ...props.value }))

function onChange(d) { emit('update:value', props.block.id, d) }

function openLevelUp() {
  close()
  levelUpOpen.value = true
}

// Окно повышения возвращает пачку изменений по разным блокам листа
// (lvl / classes / hp / abilities_class / ...) — раскладываем по ключам.
function applyLevelUp(updates) {
  for (const [id, value] of Object.entries(updates)) {
    emit('update:value', id === 'lvl' ? props.block.id : id, value)
  }
  levelUpOpen.value = false
}
</script>

<style scoped>
.lvl-tile { width: 100%; }
</style>
