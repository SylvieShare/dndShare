<template>
  <BasePopover v-model:open="open" :anchor="anchor" :min-width="210" placement="bottom-start">
    <div v-if="scene" class="scene-graph-menu">
      <RowActionItem action="edit" @click="run('edit', scene)">Редактировать</RowActionItem>
      <RowActionItem action="delete" tone="danger" @click="run('delete', scene)">Удалить</RowActionItem>
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
const scene = ref(null)

function openFor(nextScene, nextAnchor) {
  scene.value = nextScene
  anchor.value = nextAnchor
  open.value = true
}

function close() {
  open.value = false
}

function run(event, value) {
  close()
  emit(event, value)
}

defineExpose({ openFor, close })
</script>

<style scoped>
.scene-graph-menu { display: flex; min-width: 200px; flex-direction: column; gap: 2px; padding: 5px; }
</style>
