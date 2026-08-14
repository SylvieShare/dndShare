<template>
  <BasePopover v-model:open="open" :anchor="anchor" :min-width="210">
    <div v-if="edge" class="nested-edge-menu">
      <RowActionItem action="edit" @click="run('edit')">Изменить подпись</RowActionItem>
      <RowActionItem action="delete" tone="danger" @click="run('delete')">Удалить переход</RowActionItem>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

const emit = defineEmits(['edit', 'delete'])
const open = ref(false)
const anchor = ref(null)
const edge = ref(null)
const level = ref(null)

function openFor(nextEdge, nextLevel, nextAnchor) {
  edge.value = nextEdge
  level.value = nextLevel
  anchor.value = nextAnchor
  open.value = true
}

function close() {
  open.value = false
}

function run(event) {
  const activeEdge = edge.value
  const activeLevel = level.value
  close()
  emit(event, activeEdge, activeLevel)
}

defineExpose({ openFor, close })
</script>

<style scoped>
.nested-edge-menu { display: flex; min-width: 200px; flex-direction: column; gap: 2px; padding: 5px; }
</style>
